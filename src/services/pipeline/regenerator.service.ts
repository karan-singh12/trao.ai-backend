import { KitData, Question, QuestionCategory } from '../../types/kit.types';
import { CompanyBriefGenerator } from './generators/brief.generator';
import { QuestionGenerator } from './generators/question.generator';
import { ScheduleEngine } from '../schedule/schedule.engine';
import { CoverageEngine } from '../coverage/coverage.engine';
import { CompanyCrawler } from '../crawler/company.crawler';
import { AppendixAValidator } from '../../validators/kit/appendixA.validator';

export class RegeneratorService {
  private briefGenerator: CompanyBriefGenerator;
  private questionGenerator: QuestionGenerator;
  private companyCrawler: CompanyCrawler;

  constructor() {
    this.briefGenerator = new CompanyBriefGenerator();
    this.questionGenerator = new QuestionGenerator();
    this.companyCrawler = new CompanyCrawler();
  }

  async regenerateCompanyBrief(kit: KitData): Promise<KitData> {
    const crawledData = await this.companyCrawler.crawl(kit.source.company_url);
    const newBrief = await this.briefGenerator.generate(
      kit.source.company,
      kit.source.company_url,
      crawledData
    );

    const updated: KitData = {
      ...kit,
      company_brief: newBrief,
      source: {
        ...kit.source,
        pages_used: Array.from(new Set([...kit.source.pages_used, ...(newBrief.sources || [])])),
      },
    };

    return updated;
  }

  async regenerateCategory(kit: KitData, category: QuestionCategory): Promise<KitData> {
    const existingQuestions = kit.questions || [];

    // 1. Separate questions from other categories (untouched)
    const otherCategoryQuestions = existingQuestions.filter((q) => q.category !== category);

    // 2. In target category, preserve any pinned, edited, or custom questions
    const preservedQuestions = existingQuestions.filter(
      (q) => q.category === category && (q.isEdited || q.isPinned || q.isCustom)
    );

    // 3. Find requirements relevant to this category
    const relevantRequirements = kit.role.requirements.filter((r) => {
      if (category === 'behavioural') return r.kind === 'behavioural';
      if (category === 'company-fit') return r.kind === 'domain' || r.kind === 'behavioural';
      return r.kind === 'technical' || r.kind === 'domain';
    });

    // 4. Generate fresh questions for the category
    const maxExistingId = existingQuestions.reduce((max, q) => {
      const match = q.id.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 0;
      return Math.max(max, num);
    }, 0);

    const freshQuestions = await this.questionGenerator.generateForRequirements(
      relevantRequirements,
      {
        companyName: kit.source.company,
        roleTitle: kit.role.title,
      },
      maxExistingId + 1
    );

    // Filter fresh questions to match the target category
    const filteredFresh = freshQuestions
      .filter((q) => q.category === category)
      .slice(0, Math.max(2, 6 - preservedQuestions.length));

    // 5. Merge: preserved questions first, then new generated ones
    const updatedCategoryQuestions = [...preservedQuestions, ...filteredFresh];
    const allUpdatedQuestions = [...otherCategoryQuestions, ...updatedCategoryQuestions];

    // 6. Recalculate deterministic coverage & schedule
    const coverage = CoverageEngine.checkCoverage(
      kit.role.requirements,
      allUpdatedQuestions,
      kit.coverage.passes
    );

    const schedule = ScheduleEngine.allocateSchedule(
      kit.schedule.days_available,
      allUpdatedQuestions,
      kit.role.requirements
    );

    const updatedKit: KitData = {
      ...kit,
      questions: allUpdatedQuestions,
      schedule,
      coverage,
    };

    return updatedKit;
  }

  regenerateSchedule(kit: KitData, newDaysAvailable?: number): KitData {
    const days = newDaysAvailable ?? kit.schedule.days_available;
    const schedule = ScheduleEngine.allocateSchedule(days, kit.questions, kit.role.requirements);

    return {
      ...kit,
      schedule,
    };
  }
}
