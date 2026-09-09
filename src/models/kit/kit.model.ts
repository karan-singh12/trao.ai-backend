import mongoose, { Document, Schema } from 'mongoose';
import { IKitDocument, KitData } from '../../types/kit.types';

export interface IKitMongooseDocument extends Document, Omit<IKitDocument, '_id' | 'id'> {
  toAppendixA(): KitData;
}


const RequirementSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    kind: {
      type: String,
      enum: ['technical', 'behavioural', 'domain'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['must', 'nice'],
      required: true,
    },
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    requirement_ids: [{ type: String }],
    category: {
      type: String,
      enum: ['technical', 'behavioural', 'system-design', 'company-fit'],
      required: true,
    },
    prompt: { type: String, required: true },
    answer_outline: { type: String, default: '' },
    difficulty: { type: Number, min: 1, max: 3, default: 2 },
    isEdited: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: false },
  },
  { _id: false }
);

const FlashcardSchema = new Schema(
  {
    id: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    requirement_ids: [{ type: String }],
    confidence: {
      type: String,
      enum: ['none', 'somewhat', 'confident'],
      default: 'none',
    },
    isEdited: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: false },
  },
  { _id: false }
);

const ScheduleDaySchema = new Schema(
  {
    day: { type: Number, required: true },
    focus: { type: String, required: true },
    question_ids: [{ type: String }],
    minutes: { type: Number, required: true },
  },
  { _id: false }
);

const KitSchema = new Schema<IKitMongooseDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'generating', 'completed', 'failed'],
      default: 'completed',
    },
    source: {
      company: { type: String, required: true, default: '' },
      company_url: { type: String, required: true, default: '' },
      role: { type: String, required: true, default: '' },
      location: { type: String, default: '' },
      jd_chars: { type: Number, default: 0 },
      researched_at: { type: String, default: () => new Date().toISOString() },
      pages_used: [{ type: String }],
    },
    company_brief: {
      summary: { type: String, default: '' },
      what_they_do: { type: String, default: '' },
      sources: [{ type: String }],
    },
    role: {
      title: { type: String, required: true, default: '' },
      seniority: { type: String, default: '' },
      responsibilities: [{ type: String }],
      requirements: [RequirementSchema],
    },
    questions: [QuestionSchema],
    flashcards: [FlashcardSchema],
    schedule: {
      days_available: { type: Number, required: true, default: 5 },
      days: [ScheduleDaySchema],
    },
    coverage: {
      uncovered_requirement_ids: [{ type: String }],
      passes: { type: Number, default: 1 },
    },
    error: {
      code: { type: String },
      message: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        (ret as any).id = ret._id?.toString();
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Method to export exactly conforming to Appendix A
KitSchema.methods.toAppendixA = function (): KitData {
  return {
    source: {
      company: this.source.company,
      company_url: this.source.company_url,
      role: this.source.role,
      location: this.source.location,
      jd_chars: this.source.jd_chars,
      researched_at: this.source.researched_at,
      pages_used: this.source.pages_used || [],
    },
    company_brief: {
      summary: this.company_brief.summary,
      what_they_do: this.company_brief.what_they_do,
      sources: this.company_brief.sources || [],
    },
    role: {
      title: this.role.title,
      seniority: this.role.seniority,
      responsibilities: this.role.responsibilities || [],
      requirements: (this.role.requirements || []).map((r: any) => ({
        id: r.id,
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      })),
    },
    questions: (this.questions || []).map((q: any) => ({
      id: q.id,
      requirement_ids: q.requirement_ids || [],
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline,
      difficulty: q.difficulty,
    })),
    flashcards: (this.flashcards || []).map((f: any) => ({
      id: f.id,
      front: f.front,
      back: f.back,
      requirement_ids: f.requirement_ids || [],
    })),
    schedule: {
      days_available: this.schedule.days_available,
      days: (this.schedule.days || []).map((d: any) => ({
        day: d.day,
        focus: d.focus,
        question_ids: d.question_ids || [],
        minutes: d.minutes,
      })),
    },
    coverage: {
      uncovered_requirement_ids: this.coverage.uncovered_requirement_ids || [],
      passes: this.coverage.passes || 1,
    },
  };
};

export const Kit = mongoose.model<IKitMongooseDocument>('Kit', KitSchema);
export default Kit;
