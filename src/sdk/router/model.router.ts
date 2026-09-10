import {
  ILLMProvider,
  LLMPromptOptions,
  LLMResponse,
  LLMTask,
  LLMProviderName,
  RouterStatusReport,
} from '../types/llm.types';
import { GeminiProvider } from '../providers/gemini.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import { MockLLMProvider } from '../providers/mock.provider';

export interface ModelRouterConfig {
  forceMock?: boolean;
}

export class ModelRouter implements ILLMProvider {
  readonly name = 'model-router';
  readonly defaultModel = 'dynamic-routed';

  private providers: Map<LLMProviderName, ILLMProvider> = new Map();
  private forceMock: boolean;

  constructor(config: ModelRouterConfig = {}) {
    this.forceMock =
      Boolean(config.forceMock) ||
      (process.env.NODE_ENV === 'test' && !process.env.FORCE_LIVE_LLM);

    this.initializeProviders();
  }

  private initializeProviders(): void {
    // 1. Google Gemini Provider
    this.providers.set('gemini', new GeminiProvider());

    // 2. Groq Provider
    this.providers.set('groq', new OpenAIProvider({ name: 'groq' }));

    // 3. OpenAI Provider
    this.providers.set('openai', new OpenAIProvider({ name: 'openai' }));

    // 4. OpenRouter Provider
    this.providers.set('openrouter', new OpenAIProvider({ name: 'openrouter' }));

    // 5. Resilient Mock Provider
    this.providers.set('mock', new MockLLMProvider());
  }

  /**
   * Returns list of configured and available providers.
   */
  getAvailableProviders(): LLMProviderName[] {
    if (this.forceMock) {
      return ['mock'];
    }

    const available: LLMProviderName[] = [];
    for (const [name, provider] of this.providers.entries()) {
      if (name !== 'mock' && provider.isAvailable()) {
        available.push(name);
      }
    }

    // Always keep mock available as last resort in development
    if (available.length === 0 || process.env.NODE_ENV === 'development') {
      available.push('mock');
    }

    return available;
  }

  isAvailable(): boolean {
    return this.getAvailableProviders().length > 0;
  }

  /**
   * Determine primary provider and fallback chain for a given task.
   */
  resolveRoute(
    task: LLMTask = 'general',
    preferredProvider?: string
  ): { primary: LLMProviderName; fallbackChain: LLMProviderName[] } {
    const available = this.getAvailableProviders();

    if (this.forceMock || available.length === 0) {
      return { primary: 'mock', fallbackChain: [] };
    }

    // Explicit override via prompt options
    if (preferredProvider && this.providers.has(preferredProvider as LLMProviderName)) {
      const p = preferredProvider as LLMProviderName;
      const fallbacks = available.filter((name) => name !== p);
      return { primary: p, fallbackChain: fallbacks };
    }

    // Smart default routing by task type (can be customized via env vars)
    let primaryPreference: LLMProviderName;
    let fallbackPreferences: LLMProviderName[];

    switch (task) {
      case 'extraction': {
        // High precision JSON extraction & grounded parsing: Gemini -> OpenAI -> Groq -> OpenRouter
        primaryPreference =
          (process.env.ROUTER_EXTRACTION_PROVIDER as LLMProviderName) || 'gemini';
        fallbackPreferences = ['gemini', 'openai', 'groq', 'openrouter', 'mock'];
        break;
      }
      case 'brief': {
        // Large context window (1M tokens) for scraped company pages: Gemini -> OpenRouter -> Groq -> OpenAI
        primaryPreference =
          (process.env.ROUTER_BRIEF_PROVIDER as LLMProviderName) || 'gemini';
        fallbackPreferences = ['gemini', 'openrouter', 'groq', 'openai', 'mock'];
        break;
      }
      case 'questions': {
        // Calibrated question generation, difficulty rating, scoring rubrics: OpenAI -> Groq -> Gemini -> OpenRouter
        primaryPreference =
          (process.env.ROUTER_QUESTIONS_PROVIDER as LLMProviderName) || 'openai';
        fallbackPreferences = ['openai', 'groq', 'gemini', 'openrouter', 'mock'];
        break;
      }
      case 'flashcards': {
        // Ultra-fast generation of active recall Q&A pairs: Groq -> Gemini -> OpenRouter -> OpenAI
        primaryPreference =
          (process.env.ROUTER_FLASHCARDS_PROVIDER as LLMProviderName) || 'groq';
        fallbackPreferences = ['groq', 'gemini', 'openrouter', 'openai', 'mock'];
        break;
      }
      case 'second_pass': {
        // Fast targeted generation to close missing must-have gaps: Groq -> Gemini -> OpenAI -> OpenRouter
        primaryPreference =
          (process.env.ROUTER_SECONDPASS_PROVIDER as LLMProviderName) || 'groq';
        fallbackPreferences = ['groq', 'gemini', 'openai', 'openrouter', 'mock'];
        break;
      }
      case 'general':
      default: {
        const defaultEnv = (process.env.DEFAULT_LLM_PROVIDER ||
          process.env.LLM_PROVIDER ||
          'gemini') as LLMProviderName;
        primaryPreference = defaultEnv;
        fallbackPreferences = ['gemini', 'groq', 'openai', 'openrouter', 'mock'];
        break;
      }
    }

    // Pick the primary provider: use preferred if available, otherwise first available in fallback chain
    const primary =
      available.includes(primaryPreference) && this.providers.get(primaryPreference)?.isAvailable()
        ? primaryPreference
        : fallbackPreferences.find((p) => available.includes(p)) || available[0] || 'mock';

    const fallbackChain = fallbackPreferences
      .filter((p) => p !== primary && available.includes(p))
      .concat(available.includes('mock') && !fallbackPreferences.includes('mock') ? ['mock'] : []);

    return { primary, fallbackChain };
  }

  /**
   * Generate text with task-aware routing and automatic resilient failover.
   */
  async generateText(options: LLMPromptOptions): Promise<LLMResponse<string>> {
    const task = options.task || 'general';
    const { primary, fallbackChain } = this.resolveRoute(task, options.preferredProvider);

    const attempted: string[] = [];
    const executionChain = [primary, ...fallbackChain];

    for (let i = 0; i < executionChain.length; i++) {
      const providerName = executionChain[i];
      const provider = this.providers.get(providerName);

      if (!provider || !provider.isAvailable()) {
        continue;
      }

      attempted.push(providerName);

      try {
        if (i > 0) {
          console.warn(
            `[ModelRouter] Task "${task}": Fallback executing on provider "${providerName}"...`
          );
        }

        const res = await provider.generateText(options);
        return {
          ...res,
          fallbackUsed: i > 0,
          attemptedProviders: attempted,
        };
      } catch (err: any) {
        console.warn(
          `[ModelRouter] Task "${task}": Provider "${providerName}" failed (${err.message}).`
        );

        // If this was the last provider in the chain, throw diagnostic error
        if (i === executionChain.length - 1) {
          throw new Error(
            `[ModelRouter] All routed providers failed for task "${task}". Attempted: [${attempted.join(', ')}]. Last error: ${err.message}`
          );
        }
      }
    }

    throw new Error(`[ModelRouter] No available LLM providers configured.`);
  }

  /**
   * Generate JSON with task-aware routing and automatic resilient failover.
   */
  async generateJson<T = any>(options: LLMPromptOptions): Promise<LLMResponse<T>> {
    const task = options.task || 'general';
    const { primary, fallbackChain } = this.resolveRoute(task, options.preferredProvider);

    const attempted: string[] = [];
    const executionChain = [primary, ...fallbackChain];

    for (let i = 0; i < executionChain.length; i++) {
      const providerName = executionChain[i];
      const provider = this.providers.get(providerName);

      if (!provider || !provider.isAvailable()) {
        continue;
      }

      attempted.push(providerName);

      try {
        if (i > 0) {
          console.warn(
            `[ModelRouter] Task "${task}": Fallback executing JSON on provider "${providerName}"...`
          );
        }

        const res = await provider.generateJson<T>(options);
        return {
          ...res,
          fallbackUsed: i > 0,
          attemptedProviders: attempted,
        };
      } catch (err: any) {
        console.warn(
          `[ModelRouter] Task "${task}": Provider "${providerName}" failed JSON generation (${err.message}).`
        );

        if (i === executionChain.length - 1) {
          throw new Error(
            `[ModelRouter] All routed providers failed for task "${task}". Attempted: [${attempted.join(', ')}]. Last error: ${err.message}`
          );
        }
      }
    }

    throw new Error(`[ModelRouter] No available LLM providers configured.`);
  }

  /**
   * Returns a task-scoped adapter of ILLMProvider that automatically injects task name into prompts.
   */
  forTask(task: LLMTask): ILLMProvider {
    return {
      name: `${this.name}:${task}`,
      defaultModel: this.defaultModel,
      isAvailable: () => this.isAvailable(),
      generateText: (opts: LLMPromptOptions) => this.generateText({ ...opts, task }),
      generateJson: <T = any>(opts: LLMPromptOptions) => this.generateJson<T>({ ...opts, task }),
    };
  }

  /**
   * Retrieve direct underlying provider by name.
   */
  getProvider(name: LLMProviderName): ILLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Diagnostic status report of all providers and routed tasks.
   */
  getStatus(): RouterStatusReport {
    const tasks: LLMTask[] = ['extraction', 'brief', 'questions', 'flashcards', 'second_pass', 'general'];
    const taskRoutes: any = {};

    for (const t of tasks) {
      const route = this.resolveRoute(t);
      const prov = this.providers.get(route.primary);
      taskRoutes[t] = {
        provider: route.primary,
        model: prov?.defaultModel || 'unknown',
        fallbackChain: route.fallbackChain,
      };
    }

    const availableProviders = Array.from(this.providers.entries()).map(([name, prov]) => ({
      name,
      model: prov.defaultModel,
      isAvailable: prov.isAvailable(),
    }));

    return {
      mode: this.forceMock ? 'mock' : 'smart-routed',
      availableProviders,
      taskRoutes,
    };
  }
}
