import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CoverageEngine } from '../src/services/coverage/coverage.engine';
import { Question, Requirement } from '../src/types/kit.types';

describe('CoverageEngine (Deterministic Coverage Checking)', () => {
  const requirements: Requirement[] = [
    { id: 'r1', text: '5+ years with React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'System architecture & microservices', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Mentoring junior engineers', kind: 'behavioural', priority: 'must' },
    { id: 'r4', text: 'Redis caching experience', kind: 'technical', priority: 'nice' },
  ];

  it('detects uncovered must-have requirements when gaps exist', () => {
    // Only r1 is covered
    const partialQuestions: Question[] = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'React hooks lifecycle',
        answer_outline: '',
        difficulty: 2,
      },
    ];

    const coverage = CoverageEngine.checkCoverage(requirements, partialQuestions, 1);
    assert.strictEqual(coverage.passes, 1);
    assert.ok(coverage.uncovered_requirement_ids.includes('r2'));
    assert.ok(coverage.uncovered_requirement_ids.includes('r3'));
    assert.ok(coverage.uncovered_requirement_ids.includes('r4'));
    assert.strictEqual(coverage.uncovered_requirement_ids.includes('r1'), false);

    assert.strictEqual(
      CoverageEngine.isMustCoverageComplete(requirements, partialQuestions),
      false
    );
  });

  it('reports 100% must-have complete coverage when all must-haves have questions', () => {
    const fullQuestions: Question[] = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'React internals',
        answer_outline: '',
        difficulty: 2,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'system-design',
        prompt: 'Designing a microservice bus',
        answer_outline: '',
        difficulty: 3,
      },
      {
        id: 'q3',
        requirement_ids: ['r3'],
        category: 'behavioural',
        prompt: 'Mentoring experience',
        answer_outline: '',
        difficulty: 1,
      },
    ];

    const isComplete = CoverageEngine.isMustCoverageComplete(requirements, fullQuestions);
    assert.strictEqual(isComplete, true);

    const gaps = CoverageEngine.getGaps(requirements, fullQuestions);
    assert.strictEqual(gaps.mustGaps.length, 0);
    // r4 is nice-to-have and remains in niceGaps
    assert.strictEqual(gaps.niceGaps.length, 1);
    assert.strictEqual(gaps.niceGaps[0].id, 'r4');
  });

  it('returns specific missing requirements to drive the second pass LLM step', () => {
    const questions: Question[] = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'React questions',
        answer_outline: '',
        difficulty: 2,
      },
    ];

    const gaps = CoverageEngine.getGaps(requirements, questions);
    assert.strictEqual(gaps.mustGaps.length, 2);
    const gapIds = gaps.mustGaps.map((g) => g.id);
    assert.ok(gapIds.includes('r2'));
    assert.ok(gapIds.includes('r3'));
  });

  it('generates accurate metrics in diagnostic report', () => {
    const questions: Question[] = [
      {
        id: 'q1',
        requirement_ids: ['r1', 'r2'],
        category: 'technical',
        prompt: 'Combined prompt',
        answer_outline: '',
        difficulty: 2,
      },
    ];

    const report = CoverageEngine.generateReport(requirements, questions, 2);
    assert.strictEqual(report.totalRequirements, 4);
    assert.strictEqual(report.mustRequirementsCount, 3);
    assert.strictEqual(report.coveredMustCount, 2);
    assert.strictEqual(report.isMustCoverageComplete, false);
    assert.strictEqual(report.passes, 2);
  });
});
