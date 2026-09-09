import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ScheduleEngine } from '../src/services/schedule/schedule.engine';
import { Question, Requirement } from '../src/types/kit.types';

describe('ScheduleEngine (Deterministic Arithmetic)', () => {
  const sampleRequirements: Requirement[] = [
    { id: 'r1', text: '5+ years with React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Distributed systems & Node.js', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Mentoring junior engineers', kind: 'behavioural', priority: 'must' },
    { id: 'r4', text: 'GraphQL knowledge', kind: 'technical', priority: 'nice' },
  ];

  const sampleQuestions: Question[] = [
    {
      id: 'q1',
      requirement_ids: ['r1'],
      category: 'technical',
      prompt: 'Explain React fiber reconciliation',
      answer_outline: 'Outline details',
      difficulty: 3,
    },
    {
      id: 'q2',
      requirement_ids: ['r2'],
      category: 'system-design',
      prompt: 'Design a distributed rate limiter',
      answer_outline: 'Outline details',
      difficulty: 3,
    },
    {
      id: 'q3',
      requirement_ids: ['r3'],
      category: 'behavioural',
      prompt: 'Tell me about a time you mentored an engineer',
      answer_outline: 'Outline details',
      difficulty: 2,
    },
    {
      id: 'q4',
      requirement_ids: ['r4'],
      category: 'technical',
      prompt: 'Explain GraphQL schema stitching',
      answer_outline: 'Outline details',
      difficulty: 1,
    },
    {
      id: 'q5',
      requirement_ids: ['r2'],
      category: 'technical',
      prompt: 'Event loop concurrency model in Node.js',
      answer_outline: 'Outline details',
      difficulty: 2,
    },
  ];

  it('allocates exactly N days as requested (5 days)', () => {
    const schedule = ScheduleEngine.allocateSchedule(5, sampleQuestions, sampleRequirements);

    assert.strictEqual(schedule.days_available, 5);
    assert.strictEqual(schedule.days.length, 5);
    schedule.days.forEach((day, i) => {
      assert.strictEqual(day.day, i + 1);
      assert.ok(day.focus.length > 0);
      assert.ok(Number.isInteger(day.minutes), `Day ${day.day} minutes must be integer`);
      assert.ok(day.minutes > 0, `Day ${day.day} minutes must be positive`);
    });
  });

  it('handles 1-day edge case correctly', () => {
    const schedule = ScheduleEngine.allocateSchedule(1, sampleQuestions, sampleRequirements);

    assert.strictEqual(schedule.days_available, 1);
    assert.strictEqual(schedule.days.length, 1);
    assert.strictEqual(schedule.days[0].day, 1);
    // All questions must be scheduled on day 1
    assert.strictEqual(schedule.days[0].question_ids.length, sampleQuestions.length);
    assert.ok(Number.isInteger(schedule.days[0].minutes));
  });

  it('handles 60-day edge case correctly', () => {
    const schedule = ScheduleEngine.allocateSchedule(60, sampleQuestions, sampleRequirements);

    assert.strictEqual(schedule.days_available, 60);
    assert.strictEqual(schedule.days.length, 60);
    schedule.days.forEach((d, i) => {
      assert.strictEqual(d.day, i + 1);
      assert.ok(Number.isInteger(d.minutes));
    });
  });

  it('places harder and higher-priority questions earlier in schedule', () => {
    const schedule = ScheduleEngine.allocateSchedule(4, sampleQuestions, sampleRequirements);

    // Hardest questions (difficulty 3: q1, q2) should appear in earlier days
    const earlyDayQuestionIds = [
      ...schedule.days[0].question_ids,
      ...schedule.days[1].question_ids,
    ];

    assert.ok(earlyDayQuestionIds.includes('q1') || earlyDayQuestionIds.includes('q2'));
  });

  it('ensures every must-have requirement appears in the schedule', () => {
    const schedule = ScheduleEngine.allocateSchedule(3, sampleQuestions, sampleRequirements);

    const scheduledQuestionIds = new Set(
      schedule.days.flatMap((d) => d.question_ids)
    );

    const qMap = new Map(sampleQuestions.map((q) => [q.id, q]));
    const scheduledReqIds = new Set<string>();

    for (const qId of scheduledQuestionIds) {
      const q = qMap.get(qId);
      if (q) {
        q.requirement_ids.forEach((rId) => scheduledReqIds.add(rId));
      }
    }

    const mustReqs = sampleRequirements.filter((r) => r.priority === 'must');
    for (const mustReq of mustReqs) {
      assert.ok(
        scheduledReqIds.has(mustReq.id),
        `Must-have requirement ${mustReq.id} must appear in schedule`
      );
    }
  });

  it('strictly produces integer minutes (no floats)', () => {
    const schedule = ScheduleEngine.allocateSchedule(7, sampleQuestions, sampleRequirements);

    schedule.days.forEach((d) => {
      assert.ok(
        Number.isInteger(d.minutes),
        `Day ${d.day} minutes (${d.minutes}) is not an integer`
      );
    });
  });

  it('ensures every scheduled question_ids entry refers to an existing question', () => {
    const schedule = ScheduleEngine.allocateSchedule(5, sampleQuestions, sampleRequirements);
    const validQIds = new Set(sampleQuestions.map((q) => q.id));

    schedule.days.forEach((d) => {
      d.question_ids.forEach((qId) => {
        assert.ok(
          validQIds.has(qId),
          `Scheduled question ${qId} does not exist in kit questions`
        );
      });
    });
  });
});
