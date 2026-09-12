export type RequirementKind = 'technical' | 'behavioural' | 'domain';
export type RequirementPriority = 'must' | 'nice';

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export type QuestionCategory = 'technical' | 'behavioural' | 'system-design' | 'company-fit';

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: number; // 1 to 3
  isEdited?: boolean;
  isPinned?: boolean;
  isCustom?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  confidence?: 'none' | 'somewhat' | 'confident';
  isEdited?: boolean;
  isCustom?: boolean;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
  logo_url?: string;
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  logo_url?: string;
}

export interface RoleInfo {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface KitSchedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface KitData {
  source: KitSource;
  company_brief: CompanyBrief;
  role: RoleInfo;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
}

export type KitStatus = 'draft' | 'generating' | 'completed' | 'failed';

export interface IKitDocument {
  id?: string;
  _id?: any;
  userId: any;
  status: KitStatus;
  source: KitSource;
  company_brief: CompanyBrief;
  role: RoleInfo;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
  error?: {
    code: string;
    message: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
