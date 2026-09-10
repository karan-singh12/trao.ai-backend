import { PageFetcher } from './page.fetcher';

export interface PublicDiscussionResult {
  found: boolean;
  sources: string[];
  notes: string;
  snippets: string[];
}

export class DiscussionSearcher {
  async search(
    companyName: string,
    roleTitle?: string
  ): Promise<PublicDiscussionResult> {
    return DiscussionSearcher.searchInterviewDiscussion(companyName, roleTitle);
  }

  static async search(
    companyName: string,
    roleTitle?: string
  ): Promise<PublicDiscussionResult> {
    return DiscussionSearcher.searchInterviewDiscussion(companyName, roleTitle);
  }

  /**
   * Looks up public interview discussions for a given company.
   * If not found, reports honestly without fabricating information.
   */
  static async searchInterviewDiscussion(
    companyName: string,
    _companyUrl?: string
  ): Promise<PublicDiscussionResult> {
    if (!companyName || companyName.trim().length < 2) {
      return {
        found: false,
        sources: [],
        notes: 'Company name was insufficient to search for interview discussion.',
        snippets: [],
      };
    }

    const cleanCompany = companyName.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    const query = `${cleanCompany} software engineer interview process questions`;

    try {
      // Use DuckDuckGo HTML search endpoint as a public, non-authenticated search provider
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const page = await PageFetcher.fetchPage(searchUrl, {
        timeoutMs: 4500,
        retries: 1,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      if (!page || !page.cleanedText) {
        return {
          found: false,
          sources: [],
          notes: `No public interview discussions found for ${companyName}.`,
          snippets: [],
        };
      }

      // Extract result snippet text from the search results
      const snippetRegex = /<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>(.*?)<\/a>/gi;
      const snippets: string[] = [];
      const sources: string[] = [];

      let match: RegExpExecArray | null;
      while ((match = snippetRegex.exec(page.rawHtml)) !== null && snippets.length < 5) {
        const text = PageFetcher.cleanHtml(match[1]);
        if (text && text.length > 20) {
          snippets.push(text);
        }
      }

      // Extract relevant URLs (e.g. Glassdoor, Reddit, Blind, Indeed, medium)
      const linkRegex = /<a\b[^>]*class=["'][^"']*result__url[^"']*["'][^>]*href=["']([^"']+)["']/gi;
      while ((match = linkRegex.exec(page.rawHtml)) !== null && sources.length < 3) {
        let rawHref = match[1];
        if (rawHref.includes('uddg=')) {
          const encoded = rawHref.split('uddg=')[1]?.split('&')[0];
          if (encoded) rawHref = decodeURIComponent(encoded);
        }
        if (rawHref.startsWith('http')) {
          sources.push(rawHref);
        }
      }

      if (snippets.length === 0) {
        return {
          found: false,
          sources: [],
          notes: `No direct candidate interview reviews found for ${companyName}.`,
          snippets: [],
        };
      }

      return {
        found: true,
        sources,
        notes: `Candidate discussion highlights ${companyName}'s interview focus.`,
        snippets,
      };
    } catch {
      // Gracefully report absence of discussion rather than failing
      return {
        found: false,
        sources: [],
        notes: `Unable to retrieve public interview discussion for ${companyName}.`,
        snippets: [],
      };
    }
  }
}

export default DiscussionSearcher;
