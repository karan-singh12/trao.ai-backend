import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/trao_ai';
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
export const JWT_SECRET = process.env.JWT_SECRET ?? 'trao_ai_default_jwt_secret_dev';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
