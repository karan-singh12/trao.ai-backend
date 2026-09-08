import { Router } from "express";
import healthRouter from "./health.routes";
import userRouter from "./user";

const router = Router();

router.use("/health", healthRouter);
router.use("/user", userRouter);

export default router;
