import { ILLMProvider, LLMPromptOptions, LLMResponse } from './llm.types';
import { RateLimiter } from './rate.limiter';

export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini';
  readonly defaultModel: string;
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.defaultModel = model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    // Free tier: 15 RPM, minimum 1.5s between calls
    this.rateLimiter = new RateLimiter(14, 1500);
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateText(options: LLMPromptOptions): Promise<LLMResponse<string>> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured');
    }

    await this.rateLimiter.acquire();

    const response = await RateLimiter.executeWithRetry(async () => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.defaultModel}:generateContent?key=${this.apiKey}`;

      const contents: any[] = [];
      contents.push({
        role: 'user',
        parts: [{ text: options.userPrompt }],
      });

      const body: any = {
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxTokens ?? 4096,
        },
      };

      if (options.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: options.systemPrompt }],
        };
      }

      if (options.jsonMode) {
        body.generationConfig.responseMimeType = 'application/json';
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err: any = new Error(`Gemini API error [${res.status}]: ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = (await res.json()) as any;
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';
      const tokensUsed = data?.usageMetadata?.totalTokenCount;

      return {
        text,
        tokensUsed,
      };
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
      userPrompt: `${options.userPrompt}\n\nIMPORTANT: Respond with ONLY valid JSON conforming to the requested schema. Do not enclose in backticks or markdown fences.`,
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
      console.error('[GeminiProvider] JSON parse failure. Raw text was:', textRes.text);
      throw new Error(`Failed to parse LLM JSON response: ${parseErr.message}`);
    }
  }
}
