import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AppendixAValidator } from '../src/validators/kit/appendixA.validator';
import { KitData } from '../src/types/kit.types';

describe('AppendixAValidator (Structure & Invariant Validation)', () => {
  const validKit: KitData = {
    source: {
      company: 'Acme Corp',
      company_url: 'https://acme.example.com',
      role: 'Staff Engineer',
      location: 'Remote, US',
      jd_chars: 1250,
      researched_at: '2026-09-01T09:00:00Z',
      pages_used: ['https://acme.example.com/about', 'https://acme.example.com/careers'],
    },
    company_brief: {
      summary: 'Acme builds distributed telemetry solutions.',
      what_they_do: 'Enterprise observability infrastructure.',
      sources: ['https://acme.example.com/about'],
    },
    role: {
      title: 'Staff Engineer',
      seniority: 'Staff',
      responsibilities: ['Architect data pipelines', 'Mentor tech leads'],
      requirements: [
        { id: 'r1', text: 'Strong TypeScript skills', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'Distributed system design', kind: 'technical', priority: 'must' },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Explain mapped types in TypeScript',
        answer_outline: 'Explain keyof, in, etc.',
        difficulty: 2,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'system-design',
        prompt: 'Design a distributed consensus mechanism',
        answer_outline: 'Discuss Paxos vs Raft',
        difficulty: 3,
      },
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'What is the CAP Theorem?',
        back: 'Consistency, Availability, Partition Tolerance trade-offs.',
        requirement_ids: ['r2'],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        {
          day: 1,
          focus: 'Core TypeScript Deep Dive',
          question_ids: ['q1'],
          minutes: 45,
        },
        {
          day: 2,
          focus: 'Distributed Systems & Architecture',
          question_ids: ['q2'],
          minutes: 60,
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };

  it('validates a completely conforming Appendix A kit', () => {
    const result = AppendixAValidator.validate(validKit);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('fails if top-level section is missing', () => {
    const invalid = { ...validKit } as any;
    delete invalid.schedule;

    const result = AppendixAValidator.validate(invalid);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("Missing or invalid top-level section: 'schedule'")));
  });

  it('fails if difficulty is not integer 1, 2, or 3', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.questions[0].difficulty = 4;

    const result = AppendixAValidator.validate(invalid);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('difficulty must be integer 1, 2, or 3')));
  });

  it('fails if minutes is not an integer', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.schedule.days[0].minutes = 45.5;

    const result = AppendixAValidator.validate(invalid);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('must be a positive integer')));
  });

  it('fails if schedule days count does not match days_available', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.schedule.days_available = 3; // But only 2 days provided

    const result = AppendixAValidator.validate(invalid);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('does not equal schedule.days_available')));
  });

  it('fails if schedule refers to a non-existent question ID', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.schedule.days[0].question_ids = ['q999'];

    const result = AppendixAValidator.validate(invalid);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("references non-existent question ID: 'q999'")));
  });

  it('fails if a question references a non-existent requirement ID', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.questions[0].requirement_ids = ['r999'];

    const result = AppendixAValidator.validate(invalid);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("references non-existent requirement ID: 'r999'")));
  });

  it('fails if requirement IDs are duplicated', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.role.requirements.push({
      id: 'r1', // Duplicate ID
      text: 'Another requirement',
      kind: 'technical',
      priority: 'nice',
    });

    const result = AppendixAValidator.validate(invalid);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("Duplicate requirement ID: 'r1'")));
  });
});
