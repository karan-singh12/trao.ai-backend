import { Router } from 'express';
import authRoutes from './auth.route';

const userRouter = Router();

userRouter.use('/auth', authRoutes);

export default userRouter;
