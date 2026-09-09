import { Request, Response } from 'express';
import { kitRepository } from '../../repositories/kit';
import * as apiRes from '../../utils/apiResponse';
import { KIT, AUTH } from '../../utils/responseMssg';

export const getUserKits = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const kits = await kitRepository.findByUser(userId);
    return apiRes.successResponse(res, KIT.listRetrieved, kits);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const getKitById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const id = req.params.id as string;

    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const kit = await kitRepository.findById(id, userId);
    if (!kit) {
      return apiRes.notFoundResponse(res, KIT.notFound);
    }

    return apiRes.successResponse(res, KIT.retrievedSuccessfully, kit);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const createKit = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const kitData = req.body;
    const newKit = await kitRepository.create(userId, kitData);

    return apiRes.createdResponse(res, KIT.createdSuccessfully, newKit);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const updateKit = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const id = req.params.id as string;

    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const updated = await kitRepository.update(id, userId, req.body);
    if (!updated) {
      return apiRes.notFoundResponse(res, KIT.notFound);
    }

    return apiRes.successResponse(res, KIT.updatedSuccessfully, updated);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const deleteKit = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const id = req.params.id as string;

    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const deleted = await kitRepository.delete(id, userId);
    if (!deleted) {
      return apiRes.notFoundResponse(res, KIT.notFound);
    }

    return apiRes.successResponse(res, KIT.deletedSuccessfully, null);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const updateQuestion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const id = req.params.id as string;
    const questionId = req.params.questionId as string;
    const { prompt, answer_outline, difficulty, category } = req.body;

    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const updated = await kitRepository.updateQuestion(id, userId, questionId, {
      ...(prompt !== undefined && { prompt }),
      ...(answer_outline !== undefined && { answer_outline }),
      ...(difficulty !== undefined && { difficulty }),
      ...(category !== undefined && { category }),
    });

    if (!updated) {
      return apiRes.notFoundResponse(res, KIT.questionNotFound);
    }

    return apiRes.successResponse(res, KIT.questionUpdatedSuccessfully, updated);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const deleteQuestion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const id = req.params.id as string;
    const questionId = req.params.questionId as string;

    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const updated = await kitRepository.deleteQuestion(id, userId, questionId);
    if (!updated) {
      return apiRes.notFoundResponse(res, KIT.notFound);
    }

    return apiRes.successResponse(res, KIT.questionDeletedSuccessfully, updated);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const recordConfidence = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const id = req.params.id as string;
    const cardId = req.params.cardId as string;
    const { confidence } = req.body;

    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    if (!['none', 'somewhat', 'confident'].includes(confidence)) {
      return apiRes.validationErrorResponse(res, KIT.invalidConfidence);
    }

    const updated = await kitRepository.recordConfidence(id, userId, cardId, confidence);
    if (!updated) {
      return apiRes.notFoundResponse(res, KIT.flashcardNotFound);
    }

    return apiRes.successResponse(res, KIT.confidenceRecorded, updated);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};
