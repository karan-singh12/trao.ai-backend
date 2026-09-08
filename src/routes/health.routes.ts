import { Router, Request, Response } from "express";
import mongoose from "mongoose";

import { successResponse } from "../utils/apiResponse";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

  return successResponse(res, "Health check successful", {
    status: "ok",
    service: "trao-ai-backend",
    database: dbStatus,
  });
});

export default router;
