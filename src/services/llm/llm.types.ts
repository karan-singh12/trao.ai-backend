export interface LLMPromptOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse<T = any> {
  text: string;
  data?: T;
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  isAvailable(): boolean;
  generateText(options: LLMPromptOptions): Promise<LLMResponse<string>>;
  generateJson<T = any>(options: LLMPromptOptions): Promise<LLMResponse<T>>;
}
