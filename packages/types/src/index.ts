// Shared domain types used by both server and client surfaces.
// Add one file per domain entity; re-export everything here.

export type { PasswordReset } from './passwordResetTypes.js';
export type { User, UserRole } from './userTypes.js';

export type Subscription = {
  cancel_at_period_end: boolean;
  created_at: string;
  current_period_end: string | null;
  current_period_start: string | null;
  id: string;
  plan_id: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  updated_at: string;
  user_id: string;
};
