import { Router } from 'express';
import { signUp, login, getMe, logout } from '../../controllers/user/auth-api/auth.controller';
import { validate } from '../../middleware/joiValidation.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { userSignupSchema, userLoginSchema } from '../../validators/User/auth.validator';

const router = Router();

router.post('/signup', validate(userSignupSchema), signUp);
router.post('/login', validate(userLoginSchema), login);
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);

export default router;

