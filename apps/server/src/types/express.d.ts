import type { User } from 'app/schemas/authSchema.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
