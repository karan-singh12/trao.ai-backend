export interface RankedLink {
  url: string;
  text: string;
  score: number;
  category: 'hiring' | 'about' | 'tech' | 'general';
}

const HIRING_KEYWORDS = [
  'career',
  'careers',
  'jobs',
  'hiring',
  'interview',
  'interview-process',
  'join',
  'join-us',
  'work-with-us',
  'vacancies',
  'openings',
  'recruitment',
  'handbook/hiring',
  'engineering-ladder',
  'people-and-culture',
];

const ABOUT_KEYWORDS = [
  'about',
  'about-us',
  'company',
  'mission',
  'values',
  'culture',
  'team',
  'leadership',
  'who-we-are',
  'story',
  'handbook',
];

const TECH_KEYWORDS = [
  'engineering',
  'tech-stack',
  'architecture',
  'blog/engineering',
  'tech',
  'developers',
];

const PENALTY_KEYWORDS = [
  'privacy',
  'terms',
  'tos',
  'cookie',
  'legal',
  'gdpr',
  'login',
  'signup',
  'signin',
  'register',
  'cart',
  'checkout',
  'pricing',
  'press',
  'contact',
  'status',
  'support',
  'help',
];

const STATIC_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.css',
  '.js',
  '.mp4',
  '.mp3',
];

export class LinkRanker {
  /**
   * Evaluates and ranks links from a page to prioritize hiring, about, and tech information.
   */
  static rankLinks(
    links: Array<{ url: string; text: string }>,
    originUrl: string
  ): RankedLink[] {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(originUrl);
    } catch {
      return [];
    }

    const seenUrls = new Set<string>();
    const ranked: RankedLink[] = [];

    for (const link of links) {
      let parsedLink: URL;
      try {
        parsedLink = new URL(link.url);
      } catch {
        continue;
      }

      // Check same domain or sub-path (Section 9: must handle relative links on local server)
      if (parsedLink.hostname !== parsedOrigin.hostname) {
        continue;
      }

      const normalizedUrl = `${parsedLink.origin}${parsedLink.pathname}`.replace(/\/$/, '');
      if (seenUrls.has(normalizedUrl)) {
        continue;
      }
      seenUrls.add(normalizedUrl);

      // Check for static asset extensions
      const lowerPath = parsedLink.pathname.toLowerCase();
      if (STATIC_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
        continue;
      }

      const lowerText = link.text.toLowerCase();
      const combined = `${lowerPath} ${lowerText}`;

      let score = 0;
      let category: 'hiring' | 'about' | 'tech' | 'general' = 'general';

      // Check penalties
      for (const penalty of PENALTY_KEYWORDS) {
        if (combined.includes(penalty)) {
          score -= 100;
        }
      }

      // Check hiring terms (highest priority)
      for (const hiring of HIRING_KEYWORDS) {
        if (lowerPath.includes(hiring)) {
          score += 60;
          category = 'hiring';
        } else if (lowerText.includes(hiring)) {
          score += 40;
          category = 'hiring';
        }
      }

      // Check about terms
      for (const about of ABOUT_KEYWORDS) {
        if (lowerPath.includes(about)) {
          score += 35;
          if (category === 'general') category = 'about';
        } else if (lowerText.includes(about)) {
          score += 25;
          if (category === 'general') category = 'about';
        }
      }

      // Check tech terms
      for (const tech of TECH_KEYWORDS) {
        if (lowerPath.includes(tech)) {
          score += 25;
          if (category === 'general') category = 'tech';
        } else if (lowerText.includes(tech)) {
          score += 15;
          if (category === 'general') category = 'tech';
        }
      }

      // Only include links with positive relevance
      if (score > 0) {
        ranked.push({
          url: link.url,
          text: link.text,
          score,
          category,
        });
      }
    }

    return ranked.sort((a, b) => b.score - a.score);
  }

  /**
   * Selects the most promising hiring page and about page from ranked candidates.
   */
  static selectBestCandidatePages(
    rankedLinks: RankedLink[],
    maxPages: number = 3
  ): RankedLink[] {
    const selected: RankedLink[] = [];
    const usedCategories = new Set<string>();

    // Pick top hiring link first
    const bestHiring = rankedLinks.find((l) => l.category === 'hiring');
    if (bestHiring) {
      selected.push(bestHiring);
      usedCategories.add('hiring');
    }

    // Pick top about link next
    const bestAbout = rankedLinks.find((l) => l.category === 'about');
    if (bestAbout && !selected.some((s) => s.url === bestAbout.url)) {
      selected.push(bestAbout);
      usedCategories.add('about');
    }

    // Fill remaining up to maxPages with next highest scores
    for (const link of rankedLinks) {
      if (selected.length >= maxPages) break;
      if (!selected.some((s) => s.url === link.url)) {
        selected.push(link);
      }
    }

    return selected;
  }
}

export default LinkRanker;
