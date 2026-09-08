import { Router } from 'express';
import { signUp, login } from '../../controllers/user/auth-api/auth.controller';
import { validate } from '../../middleware/joiValidation.middleware';
import { userSignupSchema, userLoginSchema } from '../../validators/User/auth.validator';

const router = Router();

router.post('/signup', validate(userSignupSchema), signUp);
router.post('/login', validate(userLoginSchema), login);

export default router;
