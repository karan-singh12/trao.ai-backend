import { Requirement, Question, KitCoverage } from '../../types/kit.types';

export interface DetailedCoverageReport {
  isMustCoverageComplete: boolean;
  isFullCoverageComplete: boolean;
  totalRequirements: number;
  coveredRequirementsCount: number;
  mustRequirementsCount: number;
  coveredMustCount: number;
  coveragePercentage: number;
  uncoveredMustRequirements: Requirement[];
  uncoveredNiceRequirements: Requirement[];
  uncoveredRequirementIds: string[];
  passes: number;
}

export class CoverageEngine {
  static checkCoverage(
    requirements: Requirement[],
    questions: Question[],
    passes: number = 1
  ): KitCoverage {
    const coveredIds = new Set<string>();

    for (const q of questions) {
      if (Array.isArray(q.requirement_ids)) {
        for (const reqId of q.requirement_ids) {
          coveredIds.add(reqId);
        }
      }
    }

    const uncoveredIds = requirements
      .filter((r) => !coveredIds.has(r.id))
      .map((r) => r.id);

    return {
      uncovered_requirement_ids: uncoveredIds,
      passes: Math.max(1, Math.round(passes)),
    };
  }

  static getGaps(
    requirements: Requirement[],
    questions: Question[]
  ): {
    mustGaps: Requirement[];
    niceGaps: Requirement[];
    allGaps: Requirement[];
  } {
    const coveredIds = new Set<string>();

    for (const q of questions) {
      if (Array.isArray(q.requirement_ids)) {
        for (const reqId of q.requirement_ids) {
          coveredIds.add(reqId);
        }
      }
    }

    const mustGaps = requirements.filter(
      (r) => r.priority === 'must' && !coveredIds.has(r.id)
    );

    const niceGaps = requirements.filter(
      (r) => r.priority === 'nice' && !coveredIds.has(r.id)
    );

    const allGaps = [...mustGaps, ...niceGaps];

    return {
      mustGaps,
      niceGaps,
      allGaps,
    };
  }

  static isMustCoverageComplete(
    requirements: Requirement[],
    questions: Question[]
  ): boolean {
    const { mustGaps } = CoverageEngine.getGaps(requirements, questions);
    return mustGaps.length === 0;
  }

  static generateReport(
    requirements: Requirement[],
    questions: Question[],
    passes: number = 1
  ): DetailedCoverageReport {
    const { mustGaps, niceGaps } = CoverageEngine.getGaps(requirements, questions);
    const totalRequirements = requirements.length;

    const coveredIds = new Set<string>();
    for (const q of questions) {
      if (Array.isArray(q.requirement_ids)) {
        for (const reqId of q.requirement_ids) {
          coveredIds.add(reqId);
        }
      }
    }

    const coveredRequirementsCount = requirements.filter((r) =>
      coveredIds.has(r.id)
    ).length;
    const mustRequirements = requirements.filter((r) => r.priority === 'must');
    const mustRequirementsCount = mustRequirements.length;
    const coveredMustCount = mustRequirementsCount - mustGaps.length;

    const coveragePercentage =
      totalRequirements > 0
        ? Math.round((coveredRequirementsCount / totalRequirements) * 100)
        : 100;

    return {
      isMustCoverageComplete: mustGaps.length === 0,
      isFullCoverageComplete: mustGaps.length === 0 && niceGaps.length === 0,
      totalRequirements,
      coveredRequirementsCount,
      mustRequirementsCount,
      coveredMustCount,
      coveragePercentage,
      uncoveredMustRequirements: mustGaps,
      uncoveredNiceRequirements: niceGaps,
      uncoveredRequirementIds: [...mustGaps, ...niceGaps].map((r) => r.id),
      passes,
    };
  }
}

export default CoverageEngine;
