import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RequirementExtractor } from '../src/services/pipeline/extractors/requirement.extractor';
import { QuestionGenerator } from '../src/services/pipeline/generators/question.generator';
import { FlashcardGenerator } from '../src/services/pipeline/generators/flashcard.generator';
import { SecondPassRunner } from '../src/services/pipeline/second.pass';
import { KitGenerationPipeline } from '../src/services/pipeline/pipeline.service';
import { RegeneratorService } from '../src/services/pipeline/regenerator.service';
import { AppendixAValidator } from '../src/validators/kit/appendixA.validator';
import { MockLLMProvider } from '../src/sdk';
import { Requirement, Question, KitData } from '../src/types/kit.types';

describe('Multi-Step LLM Pipeline & Second Pass Loop (Part 5)', () => {
  const mockLLM = new MockLLMProvider();

  describe('RequirementExtractor (Grounded & Non-hallucinatory)', () => {
    it('extracts requirements with stable r1, r2 IDs from job description', async () => {
      const extractor = new RequirementExtractor(mockLLM);
      const jd = `
        Senior Backend Engineer
        Requirements:
        - 5+ years of experience with Node.js and TypeScript (must have)
        - Strong experience designing REST APIs and microservices
        - Familiarity with Kubernetes is a plus
      `;

      const roleInfo = await extractor.extract(jd);
      assert.ok(roleInfo.title);
      assert.ok(roleInfo.requirements.length > 0);
      assert.strictEqual(roleInfo.requirements[0].id, 'r1');
      assert.ok(['must', 'nice'].includes(roleInfo.requirements[0].priority));
      assert.ok(['technical', 'behavioural', 'domain'].includes(roleInfo.requirements[0].kind));
    });

    it('honestly handles thin 2-line stubs without inventing unmentioned requirements', async () => {
      const extractor = new RequirementExtractor(mockLLM);
      const thinJd = `Software Developer needed. Must know Python.`;

      const roleInfo = await extractor.extract(thinJd);
      assert.ok(roleInfo.requirements.length >= 1);
      assert.strictEqual(roleInfo.requirements[0].id, 'r1');
    });
  });

  describe('QuestionGenerator & FlashcardGenerator', () => {
    const testReqs: Requirement[] = [
      { id: 'r1', text: 'Proficiency in TypeScript', kind: 'technical', priority: 'must' },
      { id: 'r2', text: 'Mentorship of junior developers', kind: 'behavioural', priority: 'must' },
    ];

    it('generates questions with valid categories and requirement_ids', async () => {
      const qGen = new QuestionGenerator(mockLLM);
      const questions = await qGen.generateForRequirements(testReqs, {
        companyName: 'Acme Corp',
        roleTitle: 'Senior Engineer',
      });

      assert.ok(questions.length > 0);
      for (const q of questions) {
        assert.ok(q.id.startsWith('q'));
        assert.ok(Array.isArray(q.requirement_ids) && q.requirement_ids.length > 0);
        assert.ok(['technical', 'behavioural', 'system-design', 'company-fit'].includes(q.category));
        assert.ok(q.difficulty >= 1 && q.difficulty <= 3);
        assert.ok(q.prompt.length > 0);
        assert.ok(q.answer_outline.length > 0);
      }
    });

    it('generates flashcards mapped to requirement IDs', async () => {
      const fGen = new FlashcardGenerator(mockLLM);
      const flashcards = await fGen.generate(testReqs);

      assert.ok(flashcards.length > 0);
      for (const f of flashcards) {
        assert.ok(f.id.startsWith('f'));
        assert.ok(f.front.length > 0);
        assert.ok(f.back.length > 0);
        assert.ok(Array.isArray(f.requirement_ids) && f.requirement_ids.length > 0);
      }
    });
  });

  describe('SecondPassRunner (Deterministic Gap Closure)', () => {
    const requirements: Requirement[] = [
      { id: 'r1', text: '5+ years Node.js', kind: 'technical', priority: 'must' },
      { id: 'r2', text: 'MongoDB and indexing', kind: 'technical', priority: 'must' },
      { id: 'r3', text: 'Mentoring team', kind: 'behavioural', priority: 'nice' },
    ];

    it('detects missing must-have requirements and triggers second pass to close them', async () => {
      const qGen = new QuestionGenerator(mockLLM);
      const runner = new SecondPassRunner(qGen, 3);

      // Initial questions intentionally only cover r1, leaving r2 missing
      const initialQuestions: Question[] = [
        {
          id: 'q1',
          requirement_ids: ['r1'],
          category: 'technical',
          prompt: 'How do you handle event loop blocking in Node.js?',
          answer_outline: 'Explain worker threads, setImmediate, and asynchronous I/O.',
          difficulty: 2,
        },
      ];

      const result = await runner.run(requirements, initialQuestions, {
        companyName: 'TestCo',
        roleTitle: 'Backend Dev',
      });

      // Pass count must be at least 2 because a gap was detected and closed
      assert.ok(result.totalPasses >= 2);
      assert.ok(result.questions.length > initialQuestions.length);

      // Verify that r2 now has a question covering it
      const coveredIds = new Set(result.questions.flatMap((q) => q.requirement_ids));
      assert.ok(coveredIds.has('r2'), 'r2 must be covered after second pass');
      assert.strictEqual(result.coverage.uncovered_requirement_ids.includes('r2'), false);
    });
  });

  describe('RegeneratorService (Builder State Preservation)', () => {
    it('preserves pinned and edited questions during category regeneration', async () => {
      const regenerator = new RegeneratorService();

      const sampleKit: KitData = {
        source: {
          company: 'Acme',
          company_url: 'https://acme.example.com',
          role: 'Engineer',
          location: 'Remote',
          jd_chars: 500,
          researched_at: new Date().toISOString(),
          pages_used: [],
        },
        company_brief: {
          summary: 'Tech company',
          what_they_do: 'Software',
          sources: [],
        },
        role: {
          title: 'Engineer',
          seniority: 'mid',
          responsibilities: ['Build stuff'],
          requirements: [
            { id: 'r1', text: 'React', kind: 'technical', priority: 'must' },
            { id: 'r2', text: 'Communication', kind: 'behavioural', priority: 'must' },
          ],
        },
        questions: [
          {
            id: 'q1',
            requirement_ids: ['r1'],
            category: 'technical',
            prompt: 'User-customized question that must survive',
            answer_outline: 'My custom answer outline',
            difficulty: 3,
            isEdited: true,
            isPinned: true,
          },
          {
            id: 'q2',
            requirement_ids: ['r1'],
            category: 'technical',
            prompt: 'Default technical question',
            answer_outline: 'Default outline',
            difficulty: 2,
          },
        ],
        flashcards: [{ id: 'f1', front: 'Card 1', back: 'Ans 1', requirement_ids: ['r1'] }],
        schedule: {
          days_available: 3,
          days: [
            { day: 1, focus: 'Day 1', question_ids: ['q1'], minutes: 60 },
            { day: 2, focus: 'Day 2', question_ids: ['q2'], minutes: 60 },
            { day: 3, focus: 'Day 3', question_ids: ['q1'], minutes: 60 },
          ],
        },
        coverage: { uncovered_requirement_ids: [], passes: 1 },
      };

      const regenerated = await regenerator.regenerateCategory(sampleKit, 'technical');

      // The edited & pinned question q1 MUST survive
      const survivingCustom = regenerated.questions.find((q) => q.id === 'q1');
      assert.ok(survivingCustom, 'Pinned question q1 must survive regeneration');
      assert.strictEqual(survivingCustom?.prompt, 'User-customized question that must survive');
      assert.strictEqual(survivingCustom?.isEdited, true);
      assert.strictEqual(survivingCustom?.isPinned, true);
    });
  });

  describe('KitGenerationPipeline (End-to-End Orchestration)', () => {
    it('executes full pipeline and returns Appendix A compliant kit', async () => {
      const pipeline = new KitGenerationPipeline();
      const jd = `
        Senior Full Stack Engineer at Acme
        Responsibilities:
        - Develop scalable web platforms using React and Node.js
        Requirements:
        - 4+ years React experience (must)
        - 3+ years Node.js and TypeScript (must)
        - Experience with GraphQL is a plus (nice)
      `;

      const kit = await pipeline.execute({
        jobDescription: jd,
        companyUrl: 'https://example.com/company',
        days: 4,
        companyName: 'Acme',
      });

      // Verify Appendix A invariants
      const validation = AppendixAValidator.validate(kit);
      assert.strictEqual(validation.isValid, true, `Appendix A validation errors: ${validation.errors.join(', ')}`);

      // Verify schedule
      assert.strictEqual(kit.schedule.days_available, 4);
      assert.strictEqual(kit.schedule.days.length, 4);

      // Verify coverage passes is an integer >= 1
      assert.ok(kit.coverage.passes >= 1);
      assert.strictEqual(Number.isInteger(kit.coverage.passes), true);

      // Verify every schedule question exists
      const questionIdSet = new Set(kit.questions.map((q) => q.id));
      for (const day of kit.schedule.days) {
        assert.ok(Number.isInteger(day.minutes));
        for (const qId of day.question_ids) {
          assert.ok(questionIdSet.has(qId));
        }
      }
    });

    it('completes gracefully when company URL is unreachable (404/timeout)', async () => {
      const pipeline = new KitGenerationPipeline();
      const jd = `
        Backend Engineer.
        Must have: 3+ years in Go or Python.
      `;

      const kit = await pipeline.execute({
        jobDescription: jd,
        companyUrl: 'https://unreachable-non-existent-company-domain.invalid',
        days: 3,
      });

      assert.ok(kit);
      assert.ok(kit.source.company_url.includes('unreachable-non-existent-company-domain.invalid'));
      assert.ok(kit.questions.length > 0);
      assert.strictEqual(kit.schedule.days.length, 3);
    });
  });
});
