import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../config/env';

export interface TokenPayload {
  userId: string;
  email?: string;
  role?: string;
}

export class TokenService {
  static generateAccessToken(
    userId: string,
    email?: string,
    role?: string,
    secret: string = JWT_SECRET,
    expiresIn: string = JWT_EXPIRES_IN
  ): { token: string } {
    const payload: TokenPayload = { userId, email, role };
    const token = jwt.sign(payload, secret, { expiresIn: expiresIn as any });
    return { token };
  }

  static verifyAccessToken(
    token: string,
    secret: string = JWT_SECRET
  ): TokenPayload {
    return jwt.verify(token, secret) as TokenPayload;
  }
}
