import { Router } from "express";
import healthRouter from "./health.routes";
import userRouter from "./user";
import kitRouter from "./kit";

const router = Router();

router.use("/health", healthRouter);
router.use("/user", userRouter);
router.use("/kit", kitRouter);

export default router;

