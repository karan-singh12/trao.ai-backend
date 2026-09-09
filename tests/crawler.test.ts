import { describe, it } from 'node:test';
import assert from 'node:assert';
import { UrlValidator } from '../src/services/crawler/url.validator';
import { LinkRanker } from '../src/services/crawler/link.ranker';
import { PageFetcher } from '../src/services/crawler/page.fetcher';
import { CompanyCrawler } from '../src/services/crawler/company.crawler';

describe('Crawler & Scraping Pipeline (Part 4)', () => {
  describe('UrlValidator', () => {
    it('validates and normalizes valid public URLs', () => {
      const result = UrlValidator.validate('https://example.com/careers');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.sanitizedUrl, 'https://example.com/careers');
    });

    it('adds https prefix when protocol is omitted', () => {
      const result = UrlValidator.validate('example.com/about');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.sanitizedUrl, 'https://example.com/about');
    });

    it('identifies private IP addresses and loopback', () => {
      const localhostRes = UrlValidator.validate('http://127.0.0.1:8080');
      assert.strictEqual(localhostRes.isLocalOrPrivate, true);

      const privateIpRes = UrlValidator.validate('http://192.168.1.1/admin');
      assert.strictEqual(privateIpRes.isLocalOrPrivate, true);

      const cloudMetadataRes = UrlValidator.validate('http://169.254.169.254/latest/meta-data/');
      assert.strictEqual(cloudMetadataRes.isLocalOrPrivate, true);
    });

    it('rejects unsupported protocols', () => {
      const result = UrlValidator.validate('ftp://example.com/file');
      assert.strictEqual(result.isValid, false);
      assert.ok(result.reason?.includes('Unsupported protocol'));
    });
  });

  describe('LinkRanker', () => {
    const origin = 'https://acme.example.com';
    const rawLinks = [
      { url: 'https://acme.example.com/terms-and-conditions', text: 'Terms of Service' },
      { url: 'https://acme.example.com/careers', text: 'Join Our Team' },
      { url: 'https://acme.example.com/engineering/hiring-process', text: 'How We Hire' },
      { url: 'https://acme.example.com/about-us', text: 'About Acme' },
      { url: 'https://acme.example.com/logo.png', text: 'Logo' },
      { url: 'https://external-tracker.com/link', text: 'Partner' },
    ];

    it('ranks hiring and interview links with highest priority', () => {
      const ranked = LinkRanker.rankLinks(rawLinks, origin);

      assert.ok(ranked.length > 0);
      // First link should be a hiring link
      assert.strictEqual(ranked[0].category, 'hiring');
      assert.ok(
        ranked[0].url.includes('/careers') ||
          ranked[0].url.includes('/hiring-process')
      );
    });

    it('filters out external domains and static assets', () => {
      const ranked = LinkRanker.rankLinks(rawLinks, origin);
      const urls = ranked.map((r) => r.url);

      assert.strictEqual(urls.includes('https://external-tracker.com/link'), false);
      assert.strictEqual(urls.includes('https://acme.example.com/logo.png'), false);
    });

    it('selects best candidate pages for both hiring and about', () => {
      const ranked = LinkRanker.rankLinks(rawLinks, origin);
      const candidates = LinkRanker.selectBestCandidatePages(ranked, 2);

      assert.strictEqual(candidates.length, 2);
      const categories = candidates.map((c) => c.category);
      assert.ok(categories.includes('hiring'));
      assert.ok(categories.includes('about'));
    });
  });

  describe('PageFetcher (HTML Cleaning & Extraction)', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Acme Corp | Enterprise Cloud</title>
          <style>.hero { color: red; }</style>
          <script>console.log("tracking code");</script>
        </head>
        <body>
          <nav><a href="/careers">Careers at Acme</a></nav>
          <h1>Welcome to Acme</h1>
          <p>We build &amp; scale cloud infrastructure &mdash; fast.</p>
          <svg><path d="M0 0"/></svg>
        </body>
      </html>
    `;

    it('extracts page title accurately', () => {
      const title = PageFetcher.extractTitle(rawHtml);
      assert.strictEqual(title, 'Acme Corp | Enterprise Cloud');
    });

    it('cleans HTML text, strips scripts/styles/svg, and unescapes entities', () => {
      const cleaned = PageFetcher.cleanHtml(rawHtml);

      assert.ok(!cleaned.includes('console.log'));
      assert.ok(!cleaned.includes('.hero'));
      assert.ok(cleaned.includes('Welcome to Acme'));
      assert.ok(cleaned.includes('We build & scale cloud infrastructure — fast.'));
    });

    it('extracts and resolves relative links to absolute URLs', () => {
      const links = PageFetcher.extractLinks(rawHtml, 'https://acme.example.com');
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0].url, 'https://acme.example.com/careers');
      assert.strictEqual(links[0].text, 'Careers at Acme');
    });
  });

  describe('CompanyCrawler (Graceful Degradation)', () => {
    it('gracefully handles unreachable or 404 company URLs without failing the run', async () => {
      // Use an invalid host domain that will fail DNS/connection
      const unreachableUrl = 'http://unreachable-domain-12345-nonexistent.test';
      const result = await CompanyCrawler.crawlCompany(unreachableUrl, 'NonExistent Corp');

      assert.strictEqual(result.reachable, false);
      assert.ok(result.error);
      assert.strictEqual(result.pages_used.length, 0);
      assert.strictEqual(result.hiring_page_found, false);
      assert.ok(result.combined_research_text.length > 0);
    });

    it('gracefully handles malformed URLs', async () => {
      const result = await CompanyCrawler.crawlCompany('htp://invalid format');

      assert.strictEqual(result.reachable, false);
      assert.strictEqual(result.error?.code, 'INVALID_URL');
      assert.strictEqual(result.pages_used.length, 0);
    });
  });
});
