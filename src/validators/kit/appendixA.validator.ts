import { KitData } from '../../types/kit.types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates that an object strictly conforms to Appendix A of the Trao assignment specification.
 *
 * Rules:
 * 1. All mandatory fields present and correctly typed.
 * 2. difficulty is integer 1 to 3.
 * 3. minutes is integer.
 * 4. All IDs are stable and unique within the kit.
 * 5. Every question_ids entry in schedule refers to an existing question id.
 * 6. Every requirement_ids entry in questions/flashcards refers to an existing requirement id.
 * 7. Schedule days count strictly equals days_available.
 */
export class AppendixAValidator {
  static validate(data: any): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { isValid: false, errors: ['Kit data must be a non-null object'] };
    }

    // Top-level field presence
    const requiredSections = [
      'source',
      'company_brief',
      'role',
      'questions',
      'flashcards',
      'schedule',
      'coverage',
    ];
    for (const section of requiredSections) {
      if (!data[section] || typeof data[section] !== 'object') {
        errors.push(`Missing or invalid top-level section: '${section}'`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // 1. Validate 'source'
    const source = data.source;
    if (typeof source.company !== 'string') errors.push('source.company must be a string');
    if (typeof source.company_url !== 'string') errors.push('source.company_url must be a string');
    if (typeof source.role !== 'string') errors.push('source.role must be a string');
    if (typeof source.location !== 'string') errors.push('source.location must be a string');
    if (typeof source.jd_chars !== 'number' || source.jd_chars < 0) {
      errors.push('source.jd_chars must be a non-negative number');
    }
    if (typeof source.researched_at !== 'string') errors.push('source.researched_at must be an ISO string');
    if (!Array.isArray(source.pages_used)) errors.push('source.pages_used must be an array of strings');

    // 2. Validate 'company_brief'
    const brief = data.company_brief;
    if (typeof brief.summary !== 'string') errors.push('company_brief.summary must be a string');
    if (typeof brief.what_they_do !== 'string') errors.push('company_brief.what_they_do must be a string');
    if (!Array.isArray(brief.sources)) errors.push('company_brief.sources must be an array of strings');

    // 3. Validate 'role'
    const role = data.role;
    if (typeof role.title !== 'string') errors.push('role.title must be a string');
    if (typeof role.seniority !== 'string') errors.push('role.seniority must be a string');
    if (!Array.isArray(role.responsibilities)) errors.push('role.responsibilities must be an array of strings');

    const validRequirementIds = new Set<string>();
    if (!Array.isArray(role.requirements)) {
      errors.push('role.requirements must be an array');
    } else {
      role.requirements.forEach((req: any, index: number) => {
        if (!req.id || typeof req.id !== 'string') {
          errors.push(`role.requirements[${index}].id must be a non-empty string`);
        } else if (validRequirementIds.has(req.id)) {
          errors.push(`Duplicate requirement ID: '${req.id}'`);
        } else {
          validRequirementIds.add(req.id);
        }

        if (typeof req.text !== 'string' || !req.text.trim()) {
          errors.push(`role.requirements[${index}].text must be a non-empty string`);
        }

        if (!['technical', 'behavioural', 'domain'].includes(req.kind)) {
          errors.push(
            `role.requirements[${index}].kind must be 'technical', 'behavioural', or 'domain'`
          );
        }

        if (!['must', 'nice'].includes(req.priority)) {
          errors.push(`role.requirements[${index}].priority must be 'must' or 'nice'`);
        }
      });
    }

    // 4. Validate 'questions'
    const validQuestionIds = new Set<string>();
    if (!Array.isArray(data.questions)) {
      errors.push('questions must be an array');
    } else {
      data.questions.forEach((q: any, index: number) => {
        if (!q.id || typeof q.id !== 'string') {
          errors.push(`questions[${index}].id must be a non-empty string`);
        } else if (validQuestionIds.has(q.id)) {
          errors.push(`Duplicate question ID: '${q.id}'`);
        } else {
          validQuestionIds.add(q.id);
        }

        if (!Array.isArray(q.requirement_ids)) {
          errors.push(`questions[${index}].requirement_ids must be an array`);
        } else {
          q.requirement_ids.forEach((rId: string) => {
            if (!validRequirementIds.has(rId)) {
              errors.push(
                `questions[${index}] references non-existent requirement ID: '${rId}'`
              );
            }
          });
        }

        if (
          !['technical', 'behavioural', 'system-design', 'company-fit'].includes(q.category)
        ) {
          errors.push(
            `questions[${index}].category must be 'technical', 'behavioural', 'system-design', or 'company-fit'`
          );
        }

        if (typeof q.prompt !== 'string' || !q.prompt.trim()) {
          errors.push(`questions[${index}].prompt must be a non-empty string`);
        }

        if (typeof q.answer_outline !== 'string') {
          errors.push(`questions[${index}].answer_outline must be a string`);
        }

        if (![1, 2, 3].includes(q.difficulty) || !Number.isInteger(q.difficulty)) {
          errors.push(`questions[${index}].difficulty must be integer 1, 2, or 3`);
        }
      });
    }

    // 5. Validate 'flashcards'
    const validFlashcardIds = new Set<string>();
    if (!Array.isArray(data.flashcards)) {
      errors.push('flashcards must be an array');
    } else {
      data.flashcards.forEach((f: any, index: number) => {
        if (!f.id || typeof f.id !== 'string') {
          errors.push(`flashcards[${index}].id must be a non-empty string`);
        } else if (validFlashcardIds.has(f.id)) {
          errors.push(`Duplicate flashcard ID: '${f.id}'`);
        } else {
          validFlashcardIds.add(f.id);
        }

        if (typeof f.front !== 'string' || !f.front.trim()) {
          errors.push(`flashcards[${index}].front must be a non-empty string`);
        }

        if (typeof f.back !== 'string' || !f.back.trim()) {
          errors.push(`flashcards[${index}].back must be a non-empty string`);
        }

        if (Array.isArray(f.requirement_ids)) {
          f.requirement_ids.forEach((rId: string) => {
            if (!validRequirementIds.has(rId)) {
              errors.push(
                `flashcards[${index}] references non-existent requirement ID: '${rId}'`
              );
            }
          });
        }
      });
    }

    // 6. Validate 'schedule'
    const schedule = data.schedule;
    if (!Number.isInteger(schedule.days_available) || schedule.days_available <= 0) {
      errors.push('schedule.days_available must be a positive integer');
    }

    if (!Array.isArray(schedule.days)) {
      errors.push('schedule.days must be an array');
    } else {
      if (schedule.days.length !== schedule.days_available) {
        errors.push(
          `schedule.days count (${schedule.days.length}) does not equal schedule.days_available (${schedule.days_available})`
        );
      }

      schedule.days.forEach((day: any, index: number) => {
        if (!Number.isInteger(day.day) || day.day !== index + 1) {
          errors.push(`schedule.days[${index}].day must be integer ${index + 1}`);
        }

        if (typeof day.focus !== 'string' || !day.focus.trim()) {
          errors.push(`schedule.days[${index}].focus must be a non-empty string`);
        }

        if (!Array.isArray(day.question_ids)) {
          errors.push(`schedule.days[${index}].question_ids must be an array`);
        } else {
          day.question_ids.forEach((qId: string) => {
            if (!validQuestionIds.has(qId)) {
              errors.push(
                `schedule.days[${index}] references non-existent question ID: '${qId}'`
              );
            }
          });
        }

        if (!Number.isInteger(day.minutes) || day.minutes <= 0) {
          errors.push(
            `schedule.days[${index}].minutes must be a positive integer (found: ${day.minutes})`
          );
        }
      });
    }

    // 7. Validate 'coverage'
    const coverage = data.coverage;
    if (!Array.isArray(coverage.uncovered_requirement_ids)) {
      errors.push('coverage.uncovered_requirement_ids must be an array');
    }
    if (!Number.isInteger(coverage.passes) || coverage.passes < 1) {
      errors.push('coverage.passes must be an integer >= 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static assertValid(data: any): KitData {
    const result = AppendixAValidator.validate(data);
    if (!result.isValid) {
      throw new Error(
        `Appendix A Validation Failed:\n- ${result.errors.join('\n- ')}`
      );
    }
    return data as KitData;
  }
}

export default AppendixAValidator;
