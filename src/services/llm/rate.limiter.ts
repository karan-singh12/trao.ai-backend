export class RateLimiter {
  private requestTimestamps: number[] = [];
  private maxRequestsPerMinute: number;
  private minIntervalMs: number;
  private lastRequestTime: number = 0;

  constructor(maxRequestsPerMinute: number = 15, minIntervalMs: number = 1000) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.minIntervalMs = minIntervalMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // 1. Sliding minute window check
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 60000);

    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitTime = Math.max(100, 60000 - (now - oldestInWindow) + 100);
      await this.sleep(waitTime);
      return this.acquire();
    }

    // 2. Minimum interval between consecutive requests to avoid burst limit drops
    const elapsedSinceLast = now - this.lastRequestTime;
    if (elapsedSinceLast < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsedSinceLast);
    }

    this.lastRequestTime = Date.now();
    this.requestTimestamps.push(this.lastRequestTime);
  }

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 4,
    baseDelayMs: number = 2000
  ): Promise<T> {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await operation();
      } catch (err: any) {
        attempt++;

        const isRateLimit =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          err?.code === 'RESOURCE_EXHAUSTED' ||
          err?.message?.includes('429') ||
          err?.message?.toLowerCase()?.includes('rate limit') ||
          err?.message?.toLowerCase()?.includes('quota exceeded') ||
          err?.message?.toLowerCase()?.includes('slow down');

        const isTransient =
          isRateLimit ||
          err?.status === 503 ||
          err?.status === 502 ||
          err?.code === 'ETIMEDOUT' ||
          err?.code === 'ECONNRESET';

        if (!isTransient || attempt > maxRetries) {
          throw err;
        }

        // Exponential backoff with jitter
        const jitter = Math.random() * 500;
        const delay = Math.min(30000, baseDelayMs * Math.pow(2, attempt - 1) + jitter);

        // Check if server gave a Retry-After header
        const retryAfterSec = err?.headers?.['retry-after'] || err?.retryAfter;
        const finalDelay = retryAfterSec ? Number(retryAfterSec) * 1000 : delay;

        console.warn(
          `[RateLimiter] Transient rate limit or server error encountered (attempt ${attempt}/${maxRetries}). Backing off for ${Math.round(
            finalDelay
          )}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, finalDelay));
      }
    }

    throw new Error('Max retries exceeded in RateLimiter');
  }

  static cleanJsonResponse(raw: string): string {
    if (!raw) return '{}';
    let text = raw.trim();

    // Strip markdown code blocks like ```json ... ``` or ``` ... ```
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/i, '');
      text = text.replace(/```\s*$/i, '');
    }

    // Sometimes text might have explanatory leading or trailing characters
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let startIdx = -1;

    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    if (startIdx > 0) {
      text = text.slice(startIdx);
    }

    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    let endIdx = -1;

    if (lastBrace !== -1 && lastBracket !== -1) {
      endIdx = Math.max(lastBrace, lastBracket);
    } else if (lastBrace !== -1) {
      endIdx = lastBrace;
    } else if (lastBracket !== -1) {
      endIdx = lastBracket;
    }

    if (endIdx !== -1 && endIdx < text.length - 1) {
      text = text.slice(0, endIdx + 1);
    }

    return text.trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
