import { ILLMProvider, LLMPromptOptions, LLMResponse } from '../types/llm.types';

export class MockLLMProvider implements ILLMProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-llm-v1';

  isAvailable(): boolean {
    return true;
  }

  async generateText(options: LLMPromptOptions): Promise<LLMResponse<string>> {
    return {
      text: `Mock synthesized response for query: "${options.userPrompt.substring(0, 100)}..."`,
      provider: this.name,
      model: this.defaultModel,
      tokensUsed: 42,
    };
  }

  async generateJson<T = any>(options: LLMPromptOptions): Promise<LLMResponse<T>> {
    const prompt = options.userPrompt.toLowerCase();

    // 1. Requirement Extraction
    if (
      prompt.includes('extract') &&
      (prompt.includes('requirement') || prompt.includes('responsibilities') || prompt.includes('engineering and role'))
    ) {
      const parsedData = this.generateMockRoleExtraction(options.userPrompt);
      return {
        text: JSON.stringify(parsedData),
        data: parsedData as any,
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 2. Company Brief
    if (
      prompt.includes('company_brief') ||
      prompt.includes('company brief') ||
      prompt.includes('what_they_do') ||
      prompt.includes('culture_summary')
    ) {
      const parsedData = this.generateMockCompanyBrief(options.userPrompt);
      return {
        text: JSON.stringify(parsedData),
        data: parsedData as any,
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 3. Flashcards
    if (prompt.includes('flashcard')) {
      const parsedData = this.generateMockFlashcards(options.userPrompt);
      return {
        text: JSON.stringify(parsedData),
        data: parsedData as any,
        provider: this.name,
        model: this.defaultModel,
      };
    }

    // 4. Questions / Gaps / Interview Question Generation
    if (prompt.includes('question') || prompt.includes('gap')) {
      const parsedData = this.generateMockQuestions(options.userPrompt);
      return {
        text: JSON.stringify(parsedData),
        data: parsedData as any,
        provider: this.name,
        model: this.defaultModel,
      };
    }

    return {
      text: '{}',
      data: {} as any,
      provider: this.name,
      model: this.defaultModel,
    };
  }

  private generateMockRoleExtraction(userPrompt: string): any {
    const lines = userPrompt.split('\n').map((l) => l.trim()).filter((l) => l.length > 5);

    // Extract title
    let title = 'Software Engineer';
    for (const line of lines) {
      if (
        line.toLowerCase().includes('engineer') ||
        line.toLowerCase().includes('developer') ||
        line.toLowerCase().includes('manager')
      ) {
        title = line.replace(/^[#*-]\s*/, '').slice(0, 60);
        break;
      }
    }

    const seniority = title.toLowerCase().includes('senior')
      ? 'senior'
      : title.toLowerCase().includes('lead')
      ? 'lead'
      : title.toLowerCase().includes('junior')
      ? 'junior'
      : 'mid';

    // Extract bullet points or distinct sentences
    const requirements: any[] = [];
    let reqIdx = 1;

    for (const line of lines) {
      const cleaned = line.replace(/^[#*-]\s*/, '').trim();
      const lower = cleaned.toLowerCase();

      // Look for requirement keywords
      if (
        lower.includes('experience') ||
        lower.includes('years') ||
        lower.includes('proficient') ||
        lower.includes('knowledge') ||
        lower.includes('ability to') ||
        lower.includes('strong') ||
        lower.includes('familiarity') ||
        lower.includes('understanding')
      ) {
        const isMust =
          !lower.includes('plus') &&
          !lower.includes('bonus') &&
          !lower.includes('nice to have') &&
          !lower.includes('preferred');

        const kind =
          lower.includes('communication') || lower.includes('mentor') || lower.includes('team') || lower.includes('collaborat')
            ? 'behavioural'
            : lower.includes('fintech') || lower.includes('healthcare') || lower.includes('domain') || lower.includes('compliance')
            ? 'domain'
            : 'technical';

        requirements.push({
          id: `r${reqIdx++}`,
          text: cleaned.slice(0, 160),
          kind,
          priority: isMust ? 'must' : 'nice',
        });
      }
    }

    // Default fallback if JD was ultra-thin
    if (requirements.length === 0) {
      requirements.push({
        id: 'r1',
        text: 'Demonstrated core software engineering and problem-solving capability',
        kind: 'technical',
        priority: 'must',
      });
    }

    return {
      title,
      seniority,
      responsibilities: [
        'Design, build, and maintain efficient, reusable, and reliable code.',
        'Collaborate with cross-functional teams to define, design, and ship new features.',
      ],
      requirements,
    };
  }

  private generateMockCompanyBrief(_userPrompt: string): any {
    return {
      summary: 'A fast-growing technology company delivering modern software solutions.',
      what_they_do: 'Develops and scales engineering platforms and user-facing digital applications.',
      sources: [],
    };
  }

  private generateMockQuestions(userPrompt: string): any {
    const questions: any[] = [];

    // Check if userPrompt specifies requirement IDs
    const reqMatches = userPrompt.match(/r\d+/g) || ['r1'];
    const uniqueReqs = Array.from(new Set(reqMatches));

    let qIdx = 1;
    for (const rId of uniqueReqs) {
      questions.push({
        id: `q${qIdx++}`,
        requirement_ids: [rId],
        category: 'technical',
        prompt: `Can you walk through your practical experience and technical approach regarding ${rId}?`,
        answer_outline:
          '1. Define core principles.\n2. Detail architectural trade-offs and edge cases.\n3. Mention concrete production examples.',
        difficulty: 2,
      });
    }

    if (questions.length === 0) {
      questions.push({
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Describe a significant technical challenge you solved and how you arrived at your solution.',
        answer_outline: 'Situation, task, approach taken, technical trade-offs, and measurable outcome.',
        difficulty: 2,
      });
    }

    return { questions };
  }

  private generateMockFlashcards(userPrompt: string): any {
    const flashcards: any[] = [];
    const reqMatches = userPrompt.match(/r\d+/g) || ['r1'];
    const uniqueReqs = Array.from(new Set(reqMatches));

    let fIdx = 1;
    for (const rId of uniqueReqs) {
      flashcards.push({
        id: `f${fIdx++}`,
        front: `Key Concept / Invariant for ${rId}`,
        back: `Core architectural considerations, practical implementations, and best practices associated with ${rId}.`,
        requirement_ids: [rId],
      });
    }

    return { flashcards };
  }
}
