import { UrlValidator } from './url.validator';
import { PageFetcher, FetchedPage } from './page.fetcher';
import { LinkRanker } from './link.ranker';
import { DiscussionSearcher, PublicDiscussionResult } from './discussion.searcher';

export interface CompanyResearchResult {
  reachable: boolean;
  error?: {
    code: string;
    message: string;
  };
  pages_used: string[];
  homepage_title?: string;
  homepage_content?: string;
  about_content?: string;
  hiring_content?: string;
  hiring_page_found: boolean;
  discussion_findings: PublicDiscussionResult | null;
  combined_research_text: string;
  companyUrl?: string;
  pagesUsed?: string[];
  status?: string;
  hiringContent?: string;
  aboutContent?: string;
  logo_url?: string;
}

export type CrawledCompanyData = CompanyResearchResult;

export class CompanyCrawler {
  async crawl(companyUrl: string, companyName?: string): Promise<CompanyResearchResult> {
    return CompanyCrawler.crawlCompany(companyUrl, companyName);
  }

  static async crawl(companyUrl: string, companyName?: string): Promise<CompanyResearchResult> {
    return CompanyCrawler.crawlCompany(companyUrl, companyName);
  }

  /**
   * Performs end-to-end research on a company website and public discussions.
   *
   * Features:
   * 1. Validates URLs and guards against SSRF.
   * 2. Respects robots.txt.
   * 3. Crawls homepage, ranks links, and discovers non-hardcoded hiring/about pages.
   * 4. Searches public interview discussions.
   * 5. Gracefully handles 404, timeouts, or thin content without aborting the pipeline.
   */
  static async crawlCompany(
    companyUrl: string,
    companyName?: string
  ): Promise<CompanyResearchResult> {
    const pagesUsed: string[] = [];

    // 1. Validate URL
    const urlCheck = UrlValidator.validate(companyUrl);
    if (!urlCheck.isValid || !urlCheck.sanitizedUrl) {
      return {
        reachable: false,
        error: {
          code: 'INVALID_URL',
          message: urlCheck.reason || 'Invalid company URL provided',
        },
        pages_used: [],
        hiring_page_found: false,
        discussion_findings: null,
        combined_research_text: 'Company URL is invalid or malformed.',
      };
    }

    const sanitizedUrl = urlCheck.sanitizedUrl;

    // 2. Fetch Homepage
    const isAllowed = await PageFetcher.isAllowedByRobots(sanitizedUrl);
    if (!isAllowed) {
      return {
        reachable: false,
        error: {
          code: 'ROBOTS_DISALLOWED',
          message: 'Company site disallowed crawling via robots.txt',
        },
        pages_used: [],
        hiring_page_found: false,
        discussion_findings: null,
        combined_research_text: 'Site disallowed crawling via robots.txt.',
      };
    }

    const homepage = await PageFetcher.fetchPage(sanitizedUrl, {
      timeoutMs: 6000,
      retries: 2,
    });

    if (!homepage) {
      // Unreachable, 404, or timeout
      const discussion = companyName
        ? await DiscussionSearcher.searchInterviewDiscussion(companyName, sanitizedUrl)
        : null;

      const domain = new URL(sanitizedUrl).hostname.replace(/^www\./, '');
      const fallbackLogo = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

      return {
        reachable: false,
        error: {
          code: 'COMPANY_UNREACHABLE',
          message: `Company site at ${companyUrl} was unreachable or timed out after retries.`,
        },
        pages_used: [],
        hiring_page_found: false,
        discussion_findings: discussion,
        logo_url: fallbackLogo,
        combined_research_text: `Company site at ${companyUrl} could not be retrieved.`,
      };
    }

    pagesUsed.push(homepage.url);

    // 3. Rank links from homepage to discover hiring & about pages
    const rankedLinks = LinkRanker.rankLinks(homepage.links, homepage.url);
    const candidatePages = LinkRanker.selectBestCandidatePages(rankedLinks, 2);

    let aboutContent = '';
    let hiringContent = '';
    let hiringPageFound = false;

    // 4. Fetch candidate subpages
    for (const candidate of candidatePages) {
      const allowed = await PageFetcher.isAllowedByRobots(candidate.url);
      if (!allowed) continue;

      const subpage = await PageFetcher.fetchPage(candidate.url, {
        timeoutMs: 5000,
        retries: 1,
      });

      if (subpage && subpage.cleanedText) {
        pagesUsed.push(subpage.url);

        if (candidate.category === 'hiring') {
          hiringContent = subpage.cleanedText;
          hiringPageFound = true;
        } else if (candidate.category === 'about') {
          aboutContent = subpage.cleanedText;
        } else if (!aboutContent) {
          aboutContent = subpage.cleanedText;
        }
      }
    }

    // 5. Search public interview discussions
    const inferredCompany =
      companyName ||
      homepage.title.split(/[-–|]/)[0]?.trim() ||
      new URL(sanitizedUrl).hostname.replace(/^www\./, '').split('.')[0];

    const discussion = await DiscussionSearcher.searchInterviewDiscussion(
      inferredCompany,
      sanitizedUrl
    );

    // 6. Aggregate research text for the LLM pipeline
    const textSections: string[] = [];

    textSections.push(`=== COMPANY HOMEPAGE (${homepage.url}) ===\nTitle: ${homepage.title}\n${homepage.cleanedText.substring(0, 4000)}`);

    if (aboutContent) {
      textSections.push(`=== ABOUT / CULTURE PAGE ===\n${aboutContent.substring(0, 3500)}`);
    }

    if (hiringContent) {
      textSections.push(`=== HIRING & INTERVIEW PROCESS PAGE ===\n${hiringContent.substring(0, 3500)}`);
    } else {
      textSections.push(`=== HIRING PAGE STATUS ===\nNo dedicated public hiring or interview process page was discovered.`);
    }

    if (discussion && discussion.found && discussion.snippets.length > 0) {
      textSections.push(
        `=== PUBLIC CANDIDATE INTERVIEW DISCUSSIONS ===\n${discussion.snippets.join('\n\n')}`
      );
    }

    const domain = new URL(sanitizedUrl).hostname.replace(/^www\./, '');
    const fallbackLogo = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const logoUrl = homepage.logoUrl || fallbackLogo;

    return {
      reachable: true,
      pages_used: pagesUsed,
      homepage_title: homepage.title,
      homepage_content: homepage.cleanedText,
      about_content: aboutContent || undefined,
      hiring_content: hiringContent || undefined,
      hiring_page_found: hiringPageFound,
      discussion_findings: discussion,
      logo_url: logoUrl,
      combined_research_text: textSections.join('\n\n'),
    };
  }
}

export default CompanyCrawler;
