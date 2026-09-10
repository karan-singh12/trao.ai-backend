export type LLMTask =
  | 'extraction'
  | 'brief'
  | 'questions'
  | 'flashcards'
  | 'second_pass'
  | 'general';

export type LLMProviderName = 'gemini' | 'groq' | 'openai' | 'openrouter' | 'mock';

export interface LLMPromptOptions {
  task?: LLMTask;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  preferredProvider?: LLMProviderName | string;
  preferredModel?: string;
}

export interface LLMResponse<T = any> {
  text: string;
  data?: T;
  provider: string;
  model: string;
  tokensUsed?: number;
  fallbackUsed?: boolean;
  attemptedProviders?: string[];
}

export interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  isAvailable(): boolean;
  generateText(options: LLMPromptOptions): Promise<LLMResponse<string>>;
  generateJson<T = any>(options: LLMPromptOptions): Promise<LLMResponse<T>>;
}

export interface TaskRouteDefinition {
  task: LLMTask;
  primaryProvider: LLMProviderName;
  primaryModel: string;
  fallbackChain: LLMProviderName[];
  reason: string;
}

export interface RouterStatusReport {
  mode: string;
  availableProviders: { name: string; model: string; isAvailable: boolean }[];
  taskRoutes: Record<LLMTask, { provider: string; model: string; fallbackChain: string[] }>;
}
