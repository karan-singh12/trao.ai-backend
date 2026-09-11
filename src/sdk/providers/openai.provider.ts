import { ILLMProvider, LLMPromptOptions, LLMResponse } from '../types/llm.types';
import { RateLimiter } from '../rate.limiter';

export interface OpenAIProviderConfig {
  name?: 'openai' | 'groq' | 'openrouter' | string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class OpenAIProvider implements ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  private apiKey: string;
  private baseUrl: string;
  private rateLimiter: RateLimiter;
  private extraHeaders: Record<string, string> = {};

  constructor(config: OpenAIProviderConfig = {}) {
    this.name = config.name || 'openai';

    if (this.name === 'groq') {
      this.apiKey = config.apiKey || process.env.GROQ_API_KEY || '';
      const base = process.env.GROQ_API_BASE_URL || 'https://api.groq.com';
      this.baseUrl = config.baseUrl || (base.endsWith('/openai/v1') ? base : `${base.replace(/\/+$/, '')}/openai/v1`);
      this.defaultModel = config.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      this.rateLimiter = new RateLimiter(25, 800);
    } else if (this.name === 'openrouter') {
      this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
      this.baseUrl = config.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
      this.defaultModel =
        config.model ||
        process.env.OPENROUTER_MODEL ||
        'meta-llama/llama-3.3-70b-instruct';
      this.rateLimiter = new RateLimiter(20, 1000);
      this.extraHeaders = {
        'HTTP-Referer': 'https://trao.ai',
        'X-Title': 'Trao.ai Interview Preparation',
      };
    } else {
      // Standard OpenAI
      this.name = 'openai';
      this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
      this.baseUrl = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      this.defaultModel = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      this.rateLimiter = new RateLimiter(30, 500);
    }
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateText(options: LLMPromptOptions): Promise<LLMResponse<string>> {
    if (!this.isAvailable()) {
      throw new Error(`${this.name.toUpperCase()} API key is not configured`);
    }

    await this.rateLimiter.acquire();

    const targetModel = options.preferredModel || this.defaultModel;
    const candidateModels =
      this.name === 'groq'
        ? Array.from(new Set([targetModel, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile']))
        : [targetModel];

    const response = await RateLimiter.executeWithRetry(async () => {
      const messages: any[] = [];

      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      messages.push({ role: 'user', content: options.userPrompt });

      let lastErr: any = null;

      for (const currentModel of candidateModels) {
        const body: any = {
          model: currentModel,
          messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 4096,
        };

        if (options.jsonMode) {
          body.response_format = { type: 'json_object' };
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...this.extraHeaders,
        };

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (res.status === 404 && candidateModels.length > 1) {
          const errorText = await res.text();
          lastErr = new Error(`${this.name} API error (404 for model ${currentModel}): ${errorText}`);
          continue;
        }

        if (!res.ok) {
          const errorText = await res.text();
          const err: any = new Error(`${this.name} API error (${res.status}): ${errorText}`);
          err.status = res.status;
          err.statusCode = res.status;
          throw err;
        }

        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content || '';

        return {
          text,
          provider: this.name,
          model: currentModel,
          tokensUsed: data.usage?.total_tokens,
        };
      }

      throw lastErr || new Error(`${this.name} API: Failed request`);
    });

    return response;
  }

  async generateJson<T = any>(options: LLMPromptOptions): Promise<LLMResponse<T>> {
    const textRes = await this.generateText({
      ...options,
      jsonMode: true,
      userPrompt: `${options.userPrompt}\n\nIMPORTANT: Respond with VALID JSON ONLY.`,
    });

    try {
      let raw = textRes.text.trim();
      if (raw.startsWith('```json')) {
        raw = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (raw.startsWith('```')) {
        raw = raw.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed: T = JSON.parse(raw);
      return {
        ...textRes,
        data: parsed,
      };
    } catch (err: any) {
      throw new Error(
        `${this.name}Provider: Failed to parse JSON response: ${err.message}. Raw output was:\n${textRes.text.substring(0, 500)}`
      );
    }
  }
}
