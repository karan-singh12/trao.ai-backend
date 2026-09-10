import { ILLMProvider } from './llm.types';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';
import { MockLLMProvider } from './mock.provider';

export class LLMFactory {
  private static instance: ILLMProvider | null = null;

  static getProvider(forceMock: boolean = false): ILLMProvider {
    if (forceMock || process.env.NODE_ENV === 'test' && !process.env.FORCE_LIVE_LLM) {
      return new MockLLMProvider();
    }

    if (this.instance) {
      return this.instance;
    }

    // 1. Check Google Gemini
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
      console.log('[LLMFactory] Initializing Google Gemini provider');
      this.instance = new GeminiProvider();
      return this.instance;
    }

    // 2. Check Groq
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0) {
      console.log('[LLMFactory] Initializing Groq provider');
      this.instance = new OpenAIProvider({ name: 'groq' });
      return this.instance;
    }

    // 3. Check OpenAI / OpenRouter
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
      console.log('[LLMFactory] Initializing OpenAI provider');
      this.instance = new OpenAIProvider({ name: 'openai' });
      return this.instance;
    }

    // 4. Default fallback to Mock Provider
    console.warn(
      '[LLMFactory] No LLM API key detected (GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY). Using resilient MockProvider.'
    );
    this.instance = new MockLLMProvider();
    return this.instance;
  }

  static setProvider(provider: ILLMProvider): void {
    this.instance = provider;
  }

  static reset(): void {
    this.instance = null;
  }
}
