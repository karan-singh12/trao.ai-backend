import { ILLMProvider, LLMTask, LLMProviderName } from './types/llm.types';
import { GeminiProvider, OpenAIProvider, MockLLMProvider } from './providers';
import { ModelRouter } from './router/model.router';

export class LLMFactory {
  private static routerInstance: ModelRouter | null = null;
  private static overrideInstance: ILLMProvider | null = null;
  private static mockInstance: ILLMProvider | null = null;

  /**
   * Get or initialize the smart ModelRouter singleton.
   */
  static getRouter(forceMock: boolean = false): ModelRouter {
    if (this.routerInstance) {
      return this.routerInstance;
    }

    this.routerInstance = new ModelRouter({ forceMock });
    return this.routerInstance;
  }

  /**
   * Get an ILLMProvider. Can be task-scoped (e.g. 'extraction', 'questions', 'brief', 'flashcards')
   * or a general-purpose routed provider.
   */
  static getProvider(taskOrForceMock?: LLMTask | boolean): ILLMProvider {
    if (this.overrideInstance) {
      return this.overrideInstance;
    }

    const isTestMode =
      taskOrForceMock === true ||
      (process.env.NODE_ENV === 'test' && !process.env.FORCE_LIVE_LLM);

    if (isTestMode) {
      if (!this.mockInstance) {
        this.mockInstance = new MockLLMProvider();
      }
      return this.mockInstance;
    }

    const router = this.getRouter(false);

    if (typeof taskOrForceMock === 'string') {
      return router.forTask(taskOrForceMock);
    }

    return router;
  }

  /**
   * Directly get a raw underlying provider instance by name.
   */
  static getRawProvider(name: LLMProviderName): ILLMProvider | undefined {
    return this.getRouter().getProvider(name);
  }

  static setProvider(provider: ILLMProvider): void {
    this.overrideInstance = provider;
  }

  static reset(): void {
    this.routerInstance = null;
    this.overrideInstance = null;
    this.mockInstance = null;
  }
}
