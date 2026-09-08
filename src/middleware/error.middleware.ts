import { Request, Response, NextFunction } from "express";
import { notFoundResponse, errorResponse, internalServerErrorResponse } from "../utils/apiResponse";
import { SYSTEM } from "../utils/responseMssg";

export interface AppError extends Error {
  statusCode?: number;
}

export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  return notFoundResponse(res, `Not Found - ${req.originalUrl}`);
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  console.error("Error caught in global handler:", err);

  if (err instanceof Error) {
    const appErr = err as AppError;
    const errMsg = appErr.message || "";

    if (appErr.statusCode && appErr.statusCode !== 500) {
      return errorResponse(res, errMsg, appErr.statusCode);
    }

    if (
      errMsg.includes("MongoNetworkError") ||
      errMsg.includes("MongooseServerSelectionError") ||
      errMsg.includes("database connection")
    ) {
      return internalServerErrorResponse(res, SYSTEM.databaseError);
    }

    if (process.env.NODE_ENV === "production") {
      return internalServerErrorResponse(res, SYSTEM.internalServerError);
    }

    return internalServerErrorResponse(res, errMsg);
  }

  return internalServerErrorResponse(res, SYSTEM.internalServerError);
};
