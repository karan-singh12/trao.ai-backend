import { ILLMProvider } from '../../llm/llm.types';
import { LLMFactory } from '../../llm/llm.factory';
import { Flashcard, Requirement } from '../../../types/kit.types';

export class FlashcardGenerator {
  private llm: ILLMProvider;

  constructor(llm?: ILLMProvider) {
    this.llm = llm || LLMFactory.getProvider();
  }

  async generate(requirements: Requirement[]): Promise<Flashcard[]> {
    if (!requirements || requirements.length === 0) {
      return [];
    }

    const systemPrompt = `You are an interview coach creating rapid-recall technical and behavioural flashcards.
Each flashcard has a concise prompt on the front (a core concept, trade-off, or scenario) and a clear, punchy answer/key points on the back.

RULES:
1. Every flashcard must reference the specific requirement ID it drills.
2. Front: concise question or prompt (1 sentence).
3. Back: key talking points, core invariants, or decision criteria (2-3 concise bullets).
4. Assign sequential IDs starting from "f1".

Return JSON in this format:
{
  "flashcards": [
    {
      "front": string,
      "back": string,
      "requirement_ids": string[]
    }
  ]
}`;

    const userPrompt = `Generate 1-2 high-impact study flashcards for each of the following requirements:
${requirements.map((r) => `- [${r.id}] (${r.kind}): ${r.text}`).join('\n')}`;

    try {
      const response = await this.llm.generateJson<{
        flashcards?: Array<{
          front: string;
          back: string;
          requirement_ids: string[];
        }>;
      }>({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
      });

      const raw = response.data?.flashcards || [];
      const flashcards: Flashcard[] = [];
      let fIndex = 1;

      for (const card of raw) {
        const validIds = (card.requirement_ids || []).filter((id) =>
          requirements.some((r) => r.id === id)
        );

        if (card.front && card.back) {
          flashcards.push({
            id: `f${fIndex++}`,
            front: String(card.front).trim(),
            back: String(card.back).trim(),
            requirement_ids: validIds.length > 0 ? validIds : [requirements[0].id],
          });
        }
      }

      // If LLM produced nothing or failed to cover requirements
      if (flashcards.length === 0) {
        return this.generateFallbackFlashcards(requirements);
      }

      return flashcards;
    } catch (err: any) {
      console.warn('[FlashcardGenerator] Generation fallback:', err.message);
      return this.generateFallbackFlashcards(requirements);
    }
  }

  private generateFallbackFlashcards(requirements: Requirement[]): Flashcard[] {
    return requirements.map((r, i) => ({
      id: `f${i + 1}`,
      front: `Key Invariants & Concepts: ${r.text.slice(0, 70)}...`,
      back: `Understand fundamental trade-offs, architecture patterns, and production debugging strategies for ${r.text}.`,
      requirement_ids: [r.id],
    }));
  }
}
