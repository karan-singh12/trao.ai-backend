import { Request, Response } from 'express';
import { kitRepository } from '../../repositories/kit';
import * as apiRes from '../../utils/apiResponse';
import { KIT, AUTH } from '../../utils/responseMssg';
import { KitGenerationPipeline } from '../../services/pipeline/pipeline.service';
import { RegeneratorService } from '../../services/pipeline/regenerator.service';

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

export const generateKit = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const { jd, company_url, days, company_name, location } = req.body;
    if (!jd || !company_url) {
      return apiRes.validationErrorResponse(res, 'Job description (jd) and company_url are required.');
    }

    const daysAvailable = Number(days) || 5;
    const pipeline = new KitGenerationPipeline();
    const generatedKit = await pipeline.execute({
      jobDescription: jd,
      companyUrl: company_url,
      days: daysAvailable,
      companyName: company_name,
      location,
    });

    const newKit = await kitRepository.create(userId, generatedKit);
    return apiRes.createdResponse(res, KIT.createdSuccessfully, newKit);
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const generateKitStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: AUTH.tokenRequired });
      return;
    }

    const { jd, company_url, days, company_name, location } = req.body;
    if (!jd || !company_url) {
      res.status(400).json({ success: false, message: 'Job description (jd) and company_url are required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const daysAvailable = Number(days) || 5;
    const pipeline = new KitGenerationPipeline();

    sendEvent('progress', { stage: 'START', message: 'Starting interview prep kit pipeline...' });

    const generatedKit = await pipeline.execute({
      jobDescription: jd,
      companyUrl: company_url,
      days: daysAvailable,
      companyName: company_name,
      location,
      onProgress: (stage: string, message: string) => {
        sendEvent('progress', { stage, message });
      },
    });

    const newKit = await kitRepository.create(userId, generatedKit);
    sendEvent('done', { kit: newKit });
    res.end();
  } catch (error: any) {
    const errData = {
      message: error?.message || 'Pipeline generation encountered an error.',
      code: error?.code || 'GENERATION_ERROR',
    };
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: errData });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify(errData)}\n\n`);
      res.end();
    }
  }
};

export const regenerateSection = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const id = req.params.id as string;
    const { section, category, days } = req.body;

    if (!userId) {
      return apiRes.unauthorizedResponse(res, AUTH.tokenRequired);
    }

    const kit = await kitRepository.findById(id, userId);
    if (!kit) {
      return apiRes.notFoundResponse(res, KIT.notFound);
    }

    const regenerator = new RegeneratorService();
    let updatedKitData;

    if (section === 'company_brief') {
      updatedKitData = await regenerator.regenerateCompanyBrief(kit as any);
    } else if (section === 'category') {
      if (!category) {
        return apiRes.validationErrorResponse(res, 'Category name is required for category regeneration.');
      }
      updatedKitData = await regenerator.regenerateCategory(kit as any, category);
    } else if (section === 'schedule') {
      updatedKitData = regenerator.regenerateSchedule(kit as any, days);
    } else {
      return apiRes.validationErrorResponse(res, 'Invalid section. Must be company_brief, category, or schedule.');
    }

    const updated = await kitRepository.update(id, userId, updatedKitData);
    return apiRes.successResponse(res, KIT.sectionRegenerated(section), updated);
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
