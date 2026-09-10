import { Requirement, Question, KitCoverage } from '../../types/kit.types';
import { CoverageEngine } from '../coverage/coverage.engine';
import { QuestionGenerator, QuestionGenerationContext } from './generators/question.generator';

export interface SecondPassResult {
  questions: Question[];
  coverage: KitCoverage;
  totalPasses: number;
}

export class SecondPassRunner {
  private questionGenerator: QuestionGenerator;
  private maxPasses: number;

  constructor(questionGenerator?: QuestionGenerator, maxPasses: number = 3) {
    this.questionGenerator = questionGenerator || new QuestionGenerator();
    this.maxPasses = maxPasses;
  }

  async run(
    requirements: Requirement[],
    initialQuestions: Question[],
    context: QuestionGenerationContext
  ): Promise<SecondPassResult> {
    let currentQuestions = [...initialQuestions];
    let passCount = 1;

    while (passCount <= this.maxPasses) {
      // 1. Run deterministic coverage check
      const { mustGaps, niceGaps } = CoverageEngine.getGaps(requirements, currentQuestions);

      // If all must-haves are covered, the loop objective is satisfied
      if (mustGaps.length === 0) {
        break;
      }

      // If we've reached max passes, break and report honest state
      if (passCount >= this.maxPasses) {
        console.warn(
          `[SecondPassRunner] Reached max passes (${this.maxPasses}) with ${mustGaps.length} uncovered must-have requirement(s).`
        );
        break;
      }

      // Increment pass counter for the next generation round
      passCount++;

      console.log(
        `[SecondPassRunner] Starting Pass ${passCount}: Targeting ${mustGaps.length} missing must-have requirement(s)...`
      );

      // 2. Generate targeted questions to close the identified gaps
      const startQIndex = currentQuestions.length + 1;
      const gapQuestions = await this.questionGenerator.generateTargetedGapQuestions(
        mustGaps,
        context,
        startQIndex
      );

      // Append new gap questions
      currentQuestions = [...currentQuestions, ...gapQuestions];
    }

    // Compute final Appendix A coverage summary
    const finalCoverage = CoverageEngine.checkCoverage(
      requirements,
      currentQuestions,
      passCount
    );

    return {
      questions: currentQuestions,
      coverage: finalCoverage,
      totalPasses: passCount,
    };
  }
}
