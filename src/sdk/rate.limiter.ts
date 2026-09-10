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

    // 2. Minimum interval between consecutive requests
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

        const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500, 30000);
        console.warn(
          `[SDK/RateLimiter] Attempt ${attempt}/${maxRetries} hit rate limit / transient error (${err.message}). Retrying in ${Math.round(delay)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('SDK RateLimiter: Max retries exceeded without successful response');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
