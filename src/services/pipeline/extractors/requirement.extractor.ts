import { ILLMProvider, LLMFactory } from '../../../sdk';
import { RoleInfo, Requirement } from '../../../types/kit.types';

export class RequirementExtractor {
  private llm: ILLMProvider;

  constructor(llm?: ILLMProvider) {
    this.llm = llm || LLMFactory.getProvider('extraction');
  }

  async extract(jobDescription: string): Promise<RoleInfo> {
    const trimmedJd = jobDescription.trim();

    // Check for ultra-thin stub (e.g. 2 lines)
    const lineCount = trimmedJd.split('\n').filter((l) => l.trim().length > 0).length;
    const isThinStub = lineCount <= 2 || trimmedJd.length < 150;

    const systemPrompt = `You are a precision Job Description parser for an AI Interview Preparation system.
Your mission is to extract explicitly stated requirements and responsibilities without hallucinating or inventing any items.

CRITICAL INSTRUCTIONS:
1. ONLY extract requirements that are EXPLICITLY present in the text. DO NOT invent technologies, years of experience, or responsibilities that are not mentioned.
2. If the posting is thin (e.g. 1-2 sentences), ONLY extract what is there. Reporting few requirements honestly is required.
3. Classify each requirement's priority:
   - "must": required, essential, minimum qualifications, core responsibilities, or stated as mandatory.
   - "nice": preferred, plus, bonus, nice-to-have, or optional qualifications.
4. Classify each requirement's kind:
   - "technical": specific tools, languages, frameworks, system design, databases, or engineering skills.
   - "behavioural": leadership, communication, mentorship, teamwork, ownership, or culture.
   - "domain": industry knowledge (e.g. fintech, healthcare, compliance, regulations).
5. Assign stable, 1-indexed sequential IDs: "r1", "r2", "r3", etc.
6. Determine the role title and seniority ("junior", "mid", "senior", "lead", "staff", or "principal").

Return JSON conforming strictly to:
{
  "title": string,
  "seniority": string,
  "responsibilities": string[],
  "requirements": [
    {
      "id": string,
      "text": string,
      "kind": "technical" | "behavioural" | "domain",
      "priority": "must" | "nice"
    }
  ]
}`;

    const userPrompt = `Parse the following Job Description and extract role details, responsibilities, and requirements:

${isThinStub ? '[NOTE: This job description is very brief/thin. Do not invent unmentioned skills.]\n' : ''}
---
${trimmedJd}
---`;

    try {
      const response = await this.llm.generateJson<{
        title?: string;
        seniority?: string;
        responsibilities?: string[];
        requirements?: Array<{
          id?: string;
          text: string;
          kind: 'technical' | 'behavioural' | 'domain';
          priority: 'must' | 'nice';
        }>;
      }>({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
      });

      const data = response.data || {};

      // Post-process and ensure clean Appendix A compliance
      const title = (data.title && data.title.trim()) || 'Software Engineer';
      const seniority = (data.seniority && data.seniority.trim()) || 'mid';
      const responsibilities = Array.isArray(data.responsibilities) && data.responsibilities.length > 0
        ? data.responsibilities.map((r) => String(r).trim()).filter(Boolean)
        : ['Execute assigned engineering objectives and collaborate with team members.'];

      let rawReqs = Array.isArray(data.requirements) ? data.requirements : [];

      // Guarantee at least 1 requirement even for empty/broken LLM responses
      if (rawReqs.length === 0) {
        rawReqs = [
          {
            text: isThinStub
              ? trimmedJd.slice(0, 150)
              : 'Core technical and engineering problem-solving ability',
            kind: 'technical',
            priority: 'must',
          },
        ];
      }

      // Re-index cleanly to ensure r1, r2, r3... format
      const requirements: Requirement[] = rawReqs.map((req, index) => {
        const id = `r${index + 1}`;
        const kind = ['technical', 'behavioural', 'domain'].includes(req.kind)
          ? req.kind
          : 'technical';
        const priority = ['must', 'nice'].includes(req.priority) ? req.priority : 'must';

        return {
          id,
          text: String(req.text || '').trim(),
          kind,
          priority,
        };
      });

      return {
        title,
        seniority,
        responsibilities,
        requirements,
      };
    } catch (err: any) {
      console.error('[RequirementExtractor] Extraction failed:', err.message);

      // Fallback deterministic extraction
      return {
        title: 'Software Engineer',
        seniority: 'mid',
        responsibilities: ['Develop, test, and maintain software components.'],
        requirements: [
          {
            id: 'r1',
            text: trimmedJd.slice(0, 180) || 'Proficiency in software development and engineering.',
            kind: 'technical',
            priority: 'must',
          },
        ],
      };
    }
  }
}
