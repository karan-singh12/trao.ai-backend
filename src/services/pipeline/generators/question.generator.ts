import { ILLMProvider } from '../../llm/llm.types';
import { LLMFactory } from '../../llm/llm.factory';
import { Question, Requirement, QuestionCategory } from '../../../types/kit.types';

export interface QuestionGenerationContext {
  companyName: string;
  roleTitle: string;
  hiringContext?: string;
}

export class QuestionGenerator {
  private llm: ILLMProvider;

  constructor(llm?: ILLMProvider) {
    this.llm = llm || LLMFactory.getProvider();
  }

  async generateForRequirements(
    requirements: Requirement[],
    context: QuestionGenerationContext,
    startIdIndex: number = 1
  ): Promise<Question[]> {
    if (!requirements || requirements.length === 0) {
      return [];
    }

    // Partition requirements by kind to ensure deliberate, tailored prompting
    const technicalReqs = requirements.filter((r) => r.kind === 'technical');
    const behaviouralReqs = requirements.filter((r) => r.kind === 'behavioural');
    const domainReqs = requirements.filter((r) => r.kind === 'domain');

    const generatedQuestions: Question[] = [];
    let currentId = startIdIndex;

    // 1. Generate Technical & System Design Questions
    if (technicalReqs.length > 0) {
      const techQs = await this.generateCategoryBatch(
        technicalReqs,
        ['technical', 'system-design'],
        context,
        currentId
      );
      generatedQuestions.push(...techQs);
      currentId += techQs.length;
    }

    // 2. Generate Behavioural & Company-Fit Questions
    if (behaviouralReqs.length > 0) {
      const behavQs = await this.generateCategoryBatch(
        behaviouralReqs,
        ['behavioural', 'company-fit'],
        context,
        currentId
      );
      generatedQuestions.push(...behavQs);
      currentId += behavQs.length;
    }

    // 3. Generate Domain-Specific Questions
    if (domainReqs.length > 0) {
      const domainQs = await this.generateCategoryBatch(
        domainReqs,
        ['technical', 'company-fit'],
        context,
        currentId
      );
      generatedQuestions.push(...domainQs);
      currentId += domainQs.length;
    }

    return generatedQuestions;
  }

  async generateTargetedGapQuestions(
    gapRequirements: Requirement[],
    context: QuestionGenerationContext,
    startIdIndex: number
  ): Promise<Question[]> {
    if (!gapRequirements || gapRequirements.length === 0) {
      return [];
    }

    const systemPrompt = `You are a specialized second-pass interview question designer.
Your objective is to generate rigorous, highly relevant interview questions specifically tailored to CLOSE UNCOVERED REQUIREMENTS.

RULES:
1. Every question MUST explicitly cover at least one provided uncovered requirement ID.
2. Provide a thoughtful, challenging prompt suitable for ${context.roleTitle}.
3. The answer outline must provide clear evaluation rubrics, key architectural trade-offs, or STAR principles.
4. Difficulty must be an integer between 1 and 3 (1: straightforward, 2: intermediate, 3: complex/deep-dive).
5. Category must be one of: "technical", "behavioural", "system-design", "company-fit".

Return JSON conforming to:
{
  "questions": [
    {
      "requirement_ids": string[], // must contain valid requirement IDs from the gap list
      "category": "technical" | "behavioural" | "system-design" | "company-fit",
      "prompt": string,
      "answer_outline": string,
      "difficulty": 1 | 2 | 3
    }
  ]
}`;

    const userPrompt = `Generate targeted interview questions to close the following uncovered requirements for ${context.companyName} (${context.roleTitle}):
${gapRequirements.map((r) => `- [${r.id}] (${r.priority} ${r.kind}): ${r.text}`).join('\n')}

${context.hiringContext ? `Company Hiring Insights:\n${context.hiringContext.slice(0, 1000)}\n` : ''}
Ensure EVERY requirement in the list above appears in at least one question's requirement_ids.`;

    try {
      const response = await this.llm.generateJson<{
        questions?: Array<{
          requirement_ids: string[];
          category: QuestionCategory;
          prompt: string;
          answer_outline: string;
          difficulty: number;
        }>;
      }>({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
      });

      const raw = response.data?.questions || [];
      const questions: Question[] = [];
      let qIndex = startIdIndex;

      // Track which requirements have been assigned a question
      const covered = new Set<string>();

      for (const q of raw) {
        // Only keep requirement_ids that actually belong to the gap list
        const validReqIds = (q.requirement_ids || []).filter((id) =>
          gapRequirements.some((g) => g.id === id)
        );

        if (validReqIds.length > 0) {
          validReqIds.forEach((id) => covered.add(id));
          questions.push({
            id: `q${qIndex++}`,
            requirement_ids: validReqIds,
            category: this.validateCategory(q.category),
            prompt: String(q.prompt || '').trim(),
            answer_outline: String(q.answer_outline || '').trim(),
            difficulty: this.validateDifficulty(q.difficulty),
          });
        }
      }

      // Guarantee that every single gap requirement has at least one question
      for (const gap of gapRequirements) {
        if (!covered.has(gap.id)) {
          questions.push({
            id: `q${qIndex++}`,
            requirement_ids: [gap.id],
            category: gap.kind === 'behavioural' ? 'behavioural' : 'technical',
            prompt: `How have you demonstrated mastery and applied practical problem-solving in: "${gap.text}"?`,
            answer_outline:
              '1. Architectural principles and core methodology.\n2. Concrete production examples.\n3. Measurable trade-offs and edge-case handling.',
            difficulty: 2,
          });
        }
      }

      return questions;
    } catch (err: any) {
      console.warn('[QuestionGenerator] Targeted gap generation fallback:', err.message);

      let qIndex = startIdIndex;
      return gapRequirements.map((req) => ({
        id: `q${qIndex++}`,
        requirement_ids: [req.id],
        category: (req.kind === 'behavioural' ? 'behavioural' : 'technical') as QuestionCategory,
        prompt: `Explain your end-to-end experience with: ${req.text}.`,
        answer_outline: 'Explain design choices, lessons learned, and failure recovery modes.',
        difficulty: 2,
      }));
    }
  }

  private async generateCategoryBatch(
    requirements: Requirement[],
    allowedCategories: QuestionCategory[],
    context: QuestionGenerationContext,
    startId: number
  ): Promise<Question[]> {
    const systemPrompt = `You are a senior hiring committee interviewer generating question bank items for ${context.roleTitle} at ${context.companyName}.

RULES:
1. Generate focused, high-signal questions specifically assessing the provided requirements.
2. Every question must include the corresponding requirement ID(s) it tests in "requirement_ids".
3. Categories must be chosen from: ${allowedCategories.map((c) => `"${c}"`).join(', ')}.
4. Difficulty must be an integer: 1 (fundamental), 2 (applied/intermediate), 3 (advanced architectural/strategic).
5. The answer_outline should highlight what a great candidate demonstrates.

Return JSON in this format:
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "category": "technical",
      "prompt": "...",
      "answer_outline": "...",
      "difficulty": 2
    }
  ]
}`;

    const userPrompt = `Generate 1-2 interview questions per requirement:
${requirements.map((r) => `- [${r.id}] (${r.priority} ${r.kind}): ${r.text}`).join('\n')}

${context.hiringContext ? `Hiring Context:\n${context.hiringContext.slice(0, 1000)}\n` : ''}`;

    try {
      const response = await this.llm.generateJson<{
        questions?: Array<{
          requirement_ids: string[];
          category: QuestionCategory;
          prompt: string;
          answer_outline: string;
          difficulty: number;
        }>;
      }>({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
      });

      const raw = response.data?.questions || [];
      const questions: Question[] = [];
      let qNum = startId;

      for (const q of raw) {
        const validReqIds = (q.requirement_ids || []).filter((id) =>
          requirements.some((r) => r.id === id)
        );

        if (validReqIds.length > 0 && q.prompt) {
          questions.push({
            id: `q${qNum++}`,
            requirement_ids: validReqIds,
            category: this.validateCategory(q.category, allowedCategories[0]),
            prompt: String(q.prompt).trim(),
            answer_outline: String(q.answer_outline || '').trim(),
            difficulty: this.validateDifficulty(q.difficulty),
          });
        }
      }

      return questions;
    } catch (err: any) {
      console.warn('[QuestionGenerator] Batch category generation fallback:', err.message);

      let qNum = startId;
      return requirements.map((r) => ({
        id: `q${qNum++}`,
        requirement_ids: [r.id],
        category: allowedCategories[0],
        prompt: `Can you walk through your experience and technical depth in: ${r.text}?`,
        answer_outline: 'Explain design choices, architectural trade-offs, and metrics.',
        difficulty: 2,
      }));
    }
  }

  private validateCategory(
    cat: string,
    defaultCat: QuestionCategory = 'technical'
  ): QuestionCategory {
    const valid: QuestionCategory[] = ['technical', 'behavioural', 'system-design', 'company-fit'];
    return valid.includes(cat as QuestionCategory) ? (cat as QuestionCategory) : defaultCat;
  }

  private validateDifficulty(diff: any): number {
    const num = Math.round(Number(diff));
    if (isNaN(num) || num < 1) return 1;
    if (num > 3) return 3;
    return num;
  }
}
