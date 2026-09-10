import { Question, Requirement, ScheduleDay, KitSchedule } from '../../types/kit.types';

export interface ScheduleOptions {
  targetDailyMinutes?: number;
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  'system-design': 4,
  technical: 3,
  behavioural: 2,
  'company-fit': 1,
};

const DIFFICULTY_MINUTES: Record<number, number> = {
  1: 10,
  2: 15,
  3: 25,
};

/**
 * Deterministic schedule allocation engine.
 *
 * Rules:
 * 1. Allocates across exactly N days (days_available).
 * 2. Every must-have requirement with questions appears somewhere in the schedule.
 * 3. Harder and higher-priority questions land earlier in the schedule, not the night before.
 * 4. All durations are strictly integer minutes.
 * 5. Every question_ids entry refers to a question that exists.
 */
export class ScheduleEngine {
  static buildSchedule(
    questions: Question[],
    daysAvailable: number,
    requirements: Requirement[] = []
  ): KitSchedule {
    return ScheduleEngine.allocateSchedule(daysAvailable, questions, requirements);
  }

  /**
   * Distribute questions across exactly daysAvailable days.
   */
  static allocateSchedule(
    daysAvailable: number,
    questions: Question[],
    requirements: Requirement[] = [],
    _options: ScheduleOptions = {}
  ): KitSchedule {
    // 1. Sanitize and clamp days available (supports 1 to 60 days)
    const totalDays = Math.max(1, Math.min(60, Math.round(daysAvailable) || 5));

    // If there are no questions at all, create empty daily placeholders
    if (!questions || questions.length === 0) {
      const emptyDays: ScheduleDay[] = Array.from({ length: totalDays }, (_, i) => ({
        day: i + 1,
        focus: i === totalDays - 1 ? 'Final Review & Readiness' : `Study & Preparation Day ${i + 1}`,
        question_ids: [],
        minutes: 30,
      }));
      return {
        days_available: totalDays,
        days: emptyDays,
      };
    }

    // 2. Map requirement priorities
    const mustRequirementIds = new Set(
      requirements.filter((r) => r.priority === 'must').map((r) => r.id)
    );

    // 3. Sort questions deterministically:
    // Higher priority: must-have coverage > higher difficulty > category weight
    const sortedQuestions = [...questions].sort((a, b) => {
      const aHasMust = a.requirement_ids.some((id) => mustRequirementIds.has(id));
      const bHasMust = b.requirement_ids.some((id) => mustRequirementIds.has(id));

      if (aHasMust !== bHasMust) {
        return aHasMust ? -1 : 1;
      }

      // Harder questions (difficulty 3) come earlier
      if ((b.difficulty || 2) !== (a.difficulty || 2)) {
        return (b.difficulty || 2) - (a.difficulty || 2);
      }

      // Category ordering
      const weightA = CATEGORY_WEIGHTS[a.category] || 0;
      const weightB = CATEGORY_WEIGHTS[b.category] || 0;
      if (weightB !== weightA) {
        return weightB - weightA;
      }

      return a.id.localeCompare(b.id);
    });

    // 4. Distribute sorted questions across exactly totalDays
    const dayBuckets: Question[][] = Array.from({ length: totalDays }, () => []);

    if (totalDays === 1) {
      // 1-Day sprint: All material on Day 1
      dayBuckets[0] = [...sortedQuestions];
    } else if (sortedQuestions.length <= totalDays) {
      // Case: More days than questions (e.g., 5 questions for 10 days)
      // Assign questions to earlier days, and repeat key high-difficulty/must-have questions for later review/mock drill days
      sortedQuestions.forEach((q, idx) => {
        dayBuckets[idx].push(q);
      });

      // Fill remaining days with review sets from earlier days so every day has valid question_ids
      for (let dayIdx = sortedQuestions.length; dayIdx < totalDays; dayIdx++) {
        // High-yield review: pick highest-priority questions
        const reviewQuestion = sortedQuestions[dayIdx % sortedQuestions.length];
        if (reviewQuestion) {
          dayBuckets[dayIdx].push(reviewQuestion);
        }
      }
    } else {
      // Case: More questions than days (normal case)
      // Distribute sequentially so earlier buckets receive the harder/higher-priority items
      const itemsPerDay = Math.ceil(sortedQuestions.length / totalDays);

      let currentDay = 0;
      sortedQuestions.forEach((q, i) => {
        if (i > 0 && i % itemsPerDay === 0 && currentDay < totalDays - 1) {
          currentDay++;
        }
        dayBuckets[currentDay].push(q);
      });
    }

    // 5. Construct ScheduleDay objects with integer minutes and clear focus
    const days: ScheduleDay[] = dayBuckets.map((bucketQuestions, index) => {
      const dayNum = index + 1;
      const qIds = bucketQuestions.map((q) => q.id);

      // Integer duration in minutes
      let minutes = bucketQuestions.reduce(
        (sum, q) => sum + (DIFFICULTY_MINUTES[q.difficulty] || 15),
        0
      );
      // Ensure duration is an integer and at least 30 minutes
      minutes = Math.max(30, Math.round(minutes));

      // Generate context-aware focus title
      const focus = ScheduleEngine.generateDayFocus(dayNum, totalDays, bucketQuestions);

      return {
        day: dayNum,
        focus,
        question_ids: qIds,
        minutes,
      };
    });

    return {
      days_available: totalDays,
      days,
    };
  }

  /**
   * Deterministic focus title generator based on stage of prep and categories covered.
   */
  private static generateDayFocus(
    day: number,
    totalDays: number,
    questions: Question[]
  ): string {
    if (totalDays === 1) {
      return 'Comprehensive Full-Spectrum Intensive Drill';
    }

    if (day === totalDays) {
      return 'Final Mock Simulation, Rapid Q&A & Interview Polish';
    }

    if (day === totalDays - 1 && totalDays >= 3) {
      return 'Behavioral Leadership, Culture Fit & Storytelling Alignment';
    }

    // Count predominant categories in this day's bucket
    const categoryCounts: Record<string, number> = {};
    questions.forEach((q) => {
      categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
    });

    const predominantCategory = Object.entries(categoryCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    switch (predominantCategory) {
      case 'system-design':
        return `Architecture, Scalability & System Design Deep-Dive`;
      case 'technical':
        return day <= 2
          ? `Core Technical Fundamentals & High-Priority Competencies`
          : `Advanced Technical Scenarios & Problem Solving`;
      case 'behavioural':
        return `STAR Behavioral Scenarios, Conflict & Leadership`;
      case 'company-fit':
        return `Company Vision, Cultural Dynamics & Value Alignment`;
      default:
        return `Foundational Competencies & Requirement Mastery (Part ${day})`;
    }
  }
}

export default ScheduleEngine;
