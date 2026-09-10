import { ILLMProvider, LLMPromptOptions, LLMResponse } from './llm.types';
import { RateLimiter } from './rate.limiter';

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  name?: string;
  requestsPerMinute?: number;
}

export class OpenAIProvider implements ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  private apiKey: string;
  private baseUrl: string;
  private rateLimiter: RateLimiter;

  constructor(options: OpenAIProviderOptions = {}) {
    this.name = options.name || 'openai';

    if (this.name === 'groq') {
      this.apiKey = options.apiKey || process.env.GROQ_API_KEY || '';
      this.baseUrl = options.baseUrl || 'https://api.groq.com/openai/v1';
      this.defaultModel = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      this.rateLimiter = new RateLimiter(options.requestsPerMinute ?? 20, 1000);
    } else {
      this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
      this.baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      this.defaultModel = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      this.rateLimiter = new RateLimiter(options.requestsPerMinute ?? 20, 1000);
    }
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateText(options: LLMPromptOptions): Promise<LLMResponse<string>> {
    if (!this.isAvailable()) {
      throw new Error(`${this.name} API key is not configured`);
    }

    await this.rateLimiter.acquire();

    const response = await RateLimiter.executeWithRetry(async () => {
      const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;

      const messages: any[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.userPrompt });

      const body: any = {
        model: this.defaultModel,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4096,
      };

      if (options.jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        const err: any = new Error(`${this.name} API error [${res.status}]: ${errText}`);
        err.status = res.status;
        throw err;
      }

      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content || '';
      const tokensUsed = data?.usage?.total_tokens;

      return { text, tokensUsed };
    });

    return {
      text: response.text,
      provider: this.name,
      model: this.defaultModel,
      tokensUsed: response.tokensUsed,
    };
  }

  async generateJson<T = any>(options: LLMPromptOptions): Promise<LLMResponse<T>> {
    const promptOpts = {
      ...options,
      jsonMode: true,
      userPrompt: `${options.userPrompt}\n\nIMPORTANT: Respond with pure JSON only matching the required schema. No markdown formatting.`,
    };

    const textRes = await this.generateText(promptOpts);
    const cleaned = RateLimiter.cleanJsonResponse(textRes.text);

    try {
      const parsed = JSON.parse(cleaned) as T;
      return {
        ...textRes,
        data: parsed,
      };
    } catch (parseErr: any) {
      console.error(`[${this.name}] JSON parse failure:`, textRes.text);
      throw new Error(`Failed to parse LLM JSON: ${parseErr.message}`);
    }
  }
}
