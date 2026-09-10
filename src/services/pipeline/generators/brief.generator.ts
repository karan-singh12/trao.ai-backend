import { ILLMProvider } from '../../llm/llm.types';
import { LLMFactory } from '../../llm/llm.factory';
import { CompanyBrief } from '../../../types/kit.types';
import { CrawledCompanyData } from '../../crawler/company.crawler';

export class CompanyBriefGenerator {
  private llm: ILLMProvider;

  constructor(llm?: ILLMProvider) {
    this.llm = llm || LLMFactory.getProvider();
  }

  async generate(
    companyName: string,
    companyUrl: string,
    crawledData: CrawledCompanyData,
    discussionText?: string
  ): Promise<CompanyBrief> {
    const pagesUsed = (crawledData as any).pages_used || (crawledData as any).pagesUsed || [];
    const about = (crawledData as any).about_content || (crawledData as any).aboutContent || (crawledData as any).homepage_content || '';
    const hiring = (crawledData as any).hiring_content || (crawledData as any).hiringContent || '';
    const isReachable = (crawledData as any).reachable !== false && (crawledData as any).status !== 'unreachable';
    const hasCrawledContent = Boolean(about || hiring);

    // If company was completely unreachable or 404
    if (!isReachable || !hasCrawledContent) {
      const errMsg = (crawledData as any).error?.message || 'No discoverable content';
      return {
        summary: `Public website for ${companyName} (${companyUrl}) could not be retrieved (${errMsg}).`,
        what_they_do: `Unable to verify business operations directly from ${companyUrl}. Prepare core industry fundamentals.`,
        sources: pagesUsed,
      };
    }

    const systemPrompt = `You are an analyst generating an executive company brief for interview preparation.
Base your response STRICTLY on the provided crawled website content and public discussions.

RULES:
1. Do not invent products, clients, or company history not evidenced in the sources.
2. If little is discovered, be honest and state that information is limited.
3. Incorporate hiring/interview culture if discovered in the sources.

Return JSON in this exact structure:
{
  "summary": string, // 2-3 sentences overview of the company, mission, and culture
  "what_they_do": string // Concise description of core products, services, or technical domain
}`;

    const contextSnippet = `
Company Name: ${companyName}
Company URL: ${companyUrl}

--- CRAWLED ABOUT PAGE ---
${about.slice(0, 2500)}

--- CRAWLED HIRING / CAREERS PAGE ---
${hiring.slice(0, 2500)}

--- PUBLIC INTERVIEW DISCUSSION / SENTIMENT ---
${(discussionText || 'No public interview discussions found.').slice(0, 1500)}
`;

    try {
      const response = await this.llm.generateJson<{
        summary?: string;
        what_they_do?: string;
      }>({
        systemPrompt,
        userPrompt: `Generate an honest company brief based on the crawled content:\n${contextSnippet}`,
        temperature: 0.2,
      });

      const data = response.data || {};
      const summary =
        data.summary && data.summary.trim()
          ? data.summary.trim()
          : `${companyName} is a technology company operating via ${companyUrl}.`;
      const what_they_do =
        data.what_they_do && data.what_they_do.trim()
          ? data.what_they_do.trim()
          : 'Provides software solutions and technology services.';

      return {
        summary,
        what_they_do,
        sources: pagesUsed,
      };
    } catch (err: any) {
      console.warn('[CompanyBriefGenerator] Generation failed, using grounded fallback:', err.message);
      return {
        summary: `${companyName} is an organization reachable at ${companyUrl}.`,
        what_they_do: 'Software technology products and digital engineering services.',
        sources: pagesUsed,
      };
    }
  }
}
