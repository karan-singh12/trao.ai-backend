import { UrlValidator } from './url.validator';

export interface FetchedPage {
  url: string;
  statusCode: number;
  title: string;
  cleanedText: string;
  rawHtml: string;
  links: Array<{ url: string; text: string }>;
  contentType?: string;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
  retries?: number;
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 7000;
const DEFAULT_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const DEFAULT_USER_AGENT = 'TraoAiBot/1.0 (+https://trao.ai/bot)';

export class PageFetcher {
  private static robotsCache = new Map<string, { disallowedPaths: string[]; timestamp: number }>();

  /**
   * Fetches a web page with timeout, size limits, and backoff retries.
   */
  static async fetchPage(
    rawUrl: string,
    options: FetchOptions = {}
  ): Promise<FetchedPage | null> {
    const validation = UrlValidator.validate(rawUrl);
    if (!validation.isValid || !validation.sanitizedUrl) {
      return null;
    }

    const targetUrl = validation.sanitizedUrl;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES;
    const retries = options.retries ?? 2;
    const userAgent = options.userAgent || DEFAULT_USER_AGENT;

    let attempt = 0;
    let delay = 600;

    while (attempt <= retries) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
          },
        });

        clearTimeout(timeoutHandle);

        if (!response.ok) {
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < retries
          ) {
            attempt++;
            await new Promise((res) => setTimeout(res, delay));
            delay *= 2;
            continue;
          }
          return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (
          !contentType.includes('text/html') &&
          !contentType.includes('text/plain') &&
          !contentType.includes('application/xhtml+xml')
        ) {
          return null;
        }

        const rawHtml = await response.text();
        if (rawHtml.length > maxSizeBytes) {
          return null;
        }

        const title = PageFetcher.extractTitle(rawHtml);
        const cleanedText = PageFetcher.cleanHtml(rawHtml);
        const links = PageFetcher.extractLinks(rawHtml, targetUrl);

        return {
          url: targetUrl,
          statusCode: response.status,
          title,
          cleanedText,
          rawHtml,
          links,
          contentType,
        };
      } catch (err: any) {
        clearTimeout(timeoutHandle);
        if (attempt < retries) {
          attempt++;
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2;
          continue;
        }
        return null;
      }
    }

    return null;
  }

  /**
   * Checks robots.txt for disallowed paths.
   */
  static async isAllowedByRobots(targetUrl: string): Promise<boolean> {
    try {
      const parsed = new URL(targetUrl);
      const origin = parsed.origin;
      const path = parsed.pathname;

      const cached = this.robotsCache.get(origin);
      const now = Date.now();

      let disallowed: string[] = [];

      if (cached && now - cached.timestamp < 3600000) {
        disallowed = cached.disallowedPaths;
      } else {
        const robotsUrl = `${origin}/robots.txt`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          const res = await fetch(robotsUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const text = await res.text();
            disallowed = text
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.toLowerCase().startsWith('disallow:'))
              .map((line) => line.substring('disallow:'.length).trim())
              .filter(Boolean);
          }
        } catch {
          // If robots.txt fails or times out, proceed
        }

        this.robotsCache.set(origin, { disallowedPaths: disallowed, timestamp: now });
      }

      for (const pattern of disallowed) {
        if (pattern === '/') return false;
        if (path.startsWith(pattern)) return false;
      }

      return true;
    } catch {
      return true;
    }
  }

  /**
   * Cleans raw HTML into readable, plain text and strips tags, scripts, and styles.
   */
  static cleanHtml(html: string): string {
    if (!html) return '';

    let text = html;

    // Remove script, style, noscript, svg, nav, footer tags and their contents
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');
    text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');

    // Convert breaks and block elements to newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');
    text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');

    // Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');

    // Collapse excess whitespace and blank lines
    text = text
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n');

    // Cap output characters to 12,000 characters to keep prompts concise
    return text.substring(0, 12000);
  }

  static extractTitle(html: string): string {
    const match = html.match(/<title\b[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  /**
   * Extracts links and resolves relative paths to absolute URLs.
   */
  static extractLinks(html: string, baseUrl: string): Array<{ url: string; text: string }> {
    const links: Array<{ url: string; text: string }> = [];
    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;

    let match: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((match = linkRegex.exec(html)) !== null) {
      const rawHref = match[1]?.trim();
      const rawText = match[2]?.replace(/<[^>]+>/g, '').trim() || '';

      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
        continue;
      }

      try {
        const resolved = new URL(rawHref, baseUrl);
        const resolvedStr = resolved.toString();

        if (!seen.has(resolvedStr)) {
          seen.add(resolvedStr);
          links.push({
            url: resolvedStr,
            text: rawText,
          });
        }
      } catch {
        // Skip invalid link
      }
    }

    return links;
  }
}

export default PageFetcher;
