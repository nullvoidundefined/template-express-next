// API response shape for a user. Snake_case DB columns are mapped to
// camelCase by the server's toUserResponse helper before sending.

export type UserRole = 'admin' | 'user';

export type User = {
  createdAt: string;
  email: string;
  id: string;
  role: UserRole;
  updatedAt: string | null;
};
