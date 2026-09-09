import { Kit, IKitMongooseDocument } from '../../models/kit';
import { IKitDocument, Question, Flashcard } from '../../types/kit.types';

export const kitRepository = {
  create: async (
    userId: string,
    data: Partial<IKitDocument>
  ): Promise<IKitMongooseDocument> => {
    return Kit.create({
      ...data,
      userId,
    });
  },

  findById: async (
    kitId: string,
    userId: string
  ): Promise<IKitMongooseDocument | null> => {
    return Kit.findOne({ _id: kitId, userId });
  },

  findByUser: async (userId: string): Promise<IKitMongooseDocument[]> => {
    return Kit.find({ userId }).sort({ createdAt: -1 });
  },

  update: async (
    kitId: string,
    userId: string,
    data: Partial<IKitDocument>
  ): Promise<IKitMongooseDocument | null> => {
    return Kit.findOneAndUpdate(
      { _id: kitId, userId },
      { $set: data },
      { new: true, runValidators: true }
    );
  },

  delete: async (kitId: string, userId: string): Promise<boolean> => {
    const res = await Kit.deleteOne({ _id: kitId, userId });
    return res.deletedCount > 0;
  },

  addQuestion: async (
    kitId: string,
    userId: string,
    question: Question
  ): Promise<IKitMongooseDocument | null> => {
    return Kit.findOneAndUpdate(
      { _id: kitId, userId },
      { $push: { questions: question } },
      { new: true }
    );
  },

  updateQuestion: async (
    kitId: string,
    userId: string,
    questionId: string,
    updates: Partial<Question>
  ): Promise<IKitMongooseDocument | null> => {
    const kit = await Kit.findOne({ _id: kitId, userId });
    if (!kit) return null;

    const qIndex = kit.questions.findIndex((q) => q.id === questionId);
    if (qIndex === -1) return null;

    Object.assign(kit.questions[qIndex], {
      ...updates,
      isEdited: true,
      isPinned: true,
    });

    kit.markModified('questions');
    return kit.save();
  },

  deleteQuestion: async (
    kitId: string,
    userId: string,
    questionId: string
  ): Promise<IKitMongooseDocument | null> => {
    const kit = await Kit.findOne({ _id: kitId, userId });
    if (!kit) return null;

    kit.questions = kit.questions.filter((q) => q.id !== questionId);

    // Also remove from schedule days
    kit.schedule.days = kit.schedule.days.map((d) => ({
      ...d,
      question_ids: d.question_ids.filter((qid) => qid !== questionId),
    }));

    kit.markModified('questions');
    kit.markModified('schedule');
    return kit.save();
  },

  recordConfidence: async (
    kitId: string,
    userId: string,
    cardId: string,
    confidence: 'none' | 'somewhat' | 'confident'
  ): Promise<IKitMongooseDocument | null> => {
    const kit = await Kit.findOne({ _id: kitId, userId });
    if (!kit) return null;

    const card = kit.flashcards.find((f) => f.id === cardId);
    if (card) {
      card.confidence = confidence;
      kit.markModified('flashcards');
      return kit.save();
    }
    return kit;
  },
};

export default kitRepository;
