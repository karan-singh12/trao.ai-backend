export interface AuthUser {
  userId?: any;
  id?: any;
  email?: string;
  _id?: string;
  role?: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
    interface User extends AuthUser {}
  }
}
