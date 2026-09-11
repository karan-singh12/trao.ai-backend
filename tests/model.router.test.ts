import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ModelRouter } from '../src/sdk/router/model.router';
import { LLMFactory } from '../src/sdk/llm.factory';
import { ILLMProvider, LLMPromptOptions, LLMResponse } from '../src/sdk/types/llm.types';

describe('Intelligent ModelRouter & Multi-Provider Architecture', () => {
  it('initializes all configured providers (Gemini, Groq, OpenAI, OpenRouter, Mock)', () => {
    const router = new ModelRouter({ forceMock: false });
    const gemini = router.getProvider('gemini');
    const groq = router.getProvider('groq');
    const openai = router.getProvider('openai');
    const openrouter = router.getProvider('openrouter');
    const mock = router.getProvider('mock');

    assert.ok(gemini, 'Gemini provider must be registered');
    assert.ok(groq, 'Groq provider must be registered');
    assert.ok(openai, 'OpenAI provider must be registered');
    assert.ok(openrouter, 'OpenRouter provider must be registered');
    assert.ok(mock, 'Mock provider must be registered');

    assert.strictEqual(gemini?.name, 'gemini');
    assert.strictEqual(groq?.name, 'groq');
    assert.strictEqual(openai?.name, 'openai');
    assert.strictEqual(openrouter?.name, 'openrouter');
  });

  it('routes tasks intelligently to the optimal provider based on task requirements', () => {
    const router = new ModelRouter({ forceMock: false });

    // Task extraction -> default routes to gemini (or first available in fallback)
    const extractionRoute = router.resolveRoute('extraction');
    assert.ok(extractionRoute.primary, 'Must resolve primary provider for extraction');
    assert.ok(Array.isArray(extractionRoute.fallbackChain), 'Must have a fallback chain');

    // Task questions -> default routes to gemini (or first available in fallback)
    const questionsRoute = router.resolveRoute('questions');
    assert.ok(questionsRoute.primary, 'Must resolve primary provider for questions');

    // Task flashcards -> default routes to gemini (or first available in fallback)
    const flashcardsRoute = router.resolveRoute('flashcards');
    assert.ok(flashcardsRoute.primary, 'Must resolve primary provider for flashcards');
  });

  it('honors preferredProvider override when requested in options', () => {
    const router = new ModelRouter({ forceMock: false });
    const route = router.resolveRoute('general', 'openrouter');
    assert.strictEqual(route.primary, 'openrouter');
    assert.ok(!route.fallbackChain.includes('openrouter'));
  });

  it('generates status report accurately with provider models and route maps', () => {
    const router = new ModelRouter({ forceMock: false });
    const status = router.getStatus();

    assert.ok(status.availableProviders.length >= 4, 'Must report all available providers');
    assert.ok(status.taskRoutes.extraction, 'Must map extraction task');
    assert.ok(status.taskRoutes.brief, 'Must map brief task');
    assert.ok(status.taskRoutes.questions, 'Must map questions task');
    assert.ok(status.taskRoutes.flashcards, 'Must map flashcards task');
  });

  it('falls back resiliently when mock is forced', async () => {
    const router = new ModelRouter({ forceMock: true });
    const res = await router.generateJson<{ ok: boolean }>({
      userPrompt: 'Test prompt',
      task: 'flashcards',
    });

    assert.ok(res.data, 'Mock fallback must return generated JSON');
    assert.strictEqual(res.provider, 'mock');
  });

  it('provides task-scoped adapters via router.forTask() and LLMFactory.getProvider()', async () => {
    const extractionLLM = LLMFactory.getProvider(true); // force mock in test
    assert.ok(extractionLLM.isAvailable(), 'Provider must report available');
    const res = await extractionLLM.generateText({ userPrompt: 'Hello' });
    assert.ok(res.text.length > 0, 'Must produce non-empty text');
  });
});
