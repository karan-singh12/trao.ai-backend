import { Router } from 'express';
import {
  getUserKits,
  getKitById,
  createKit,
  updateKit,
  deleteKit,
  updateQuestion,
  deleteQuestion,
  recordConfidence,
} from '../../controllers/kit/kit.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// All kit operations require an active user session
router.use(authMiddleware);

router.get('/', getUserKits);
router.post('/', createKit);
router.get('/:id', getKitById);
router.put('/:id', updateKit);
router.delete('/:id', deleteKit);

// Inline item editing
router.patch('/:id/question/:questionId', updateQuestion);
router.delete('/:id/question/:questionId', deleteQuestion);
router.post('/:id/flashcard/:cardId/confidence', recordConfidence);

export default router;
