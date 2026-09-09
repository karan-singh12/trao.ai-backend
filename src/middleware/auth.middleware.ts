import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenPayload } from '../services/auth/token.service';
import { unauthorizedResponse } from '../utils/apiResponse';
import { AUTH } from '../utils/responseMssg';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorizedResponse(res, AUTH.tokenRequired);
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const payload: TokenPayload = TokenService.verifyAccessToken(token);

    if (!payload || !payload.userId) {
      return unauthorizedResponse(res, AUTH.invalidToken);
    }

    req.user = {
      userId: payload.userId,
      id: payload.userId,
      _id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      return unauthorizedResponse(res, AUTH.tokenExpired);
    }
    return unauthorizedResponse(res, AUTH.invalidToken);
  }
};

export default authMiddleware;
