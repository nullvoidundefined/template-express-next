export const ANALYTICS_EVENTS = {
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PROFILE_UPDATED: 'profile_updated',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  USER_REGISTERED: 'user_registered',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
