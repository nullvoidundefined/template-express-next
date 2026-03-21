import type { User } from "app/schemas/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
