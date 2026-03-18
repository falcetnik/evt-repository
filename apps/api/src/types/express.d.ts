import type { AuthUser } from '../auth/auth-user.type';

declare module 'express-serve-static-core' {
  interface Request {
    currentUser?: AuthUser;
  }
}
