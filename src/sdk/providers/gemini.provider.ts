import { ILLMProvider, LLMPromptOptions, LLMResponse } from '../types/llm.types';
import { RateLimiter } from '../rate.limiter';

export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini';
  readonly defaultModel: string;
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.defaultModel = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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

    const targetModel = options.preferredModel || this.defaultModel;
    const candidateModels = Array.from(
      new Set([targetModel, 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'])
    );
    const baseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');

    const response = await RateLimiter.executeWithRetry(async () => {
      let lastErr: any = null;

      for (const currentModel of candidateModels) {
        const url = `${baseUrl}/v1beta/models/${currentModel}:generateContent?key=${this.apiKey}`;

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

        if (res.status === 404) {
          const errorText = await res.text();
          lastErr = new Error(`Gemini API error (404 for model ${currentModel}): ${errorText}`);
          continue;
        }

        if (!res.ok) {
          const errorText = await res.text();
          const err: any = new Error(`Gemini API error (${res.status}): ${errorText}`);
          err.status = res.status;
          err.statusCode = res.status;
          throw err;
        }

        const data: any = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          text,
          provider: this.name,
          model: currentModel,
          tokensUsed: data.usageMetadata?.totalTokenCount,
        };
      }

      throw lastErr || new Error('Gemini API: No supported model found on current API endpoint');
    });

    return response;
  }

  async generateJson<T = any>(options: LLMPromptOptions): Promise<LLMResponse<T>> {
    const textRes = await this.generateText({
      ...options,
      jsonMode: true,
      userPrompt: `${options.userPrompt}\n\nIMPORTANT: Respond with VALID JSON ONLY. Do not wrap in markdown codeblocks.`,
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
        `GeminiProvider: Failed to parse JSON response: ${err.message}. Raw output was:\n${textRes.text.substring(0, 500)}`
      );
    }
  }
}
