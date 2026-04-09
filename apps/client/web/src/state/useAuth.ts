'use client';

import { api } from '@/services/api';
import type { User } from '@repo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

export type { User };

// Runtime schema mirrors the User type from @repo/types.
// Keeps the TypeScript type (compile-time) and Zod schema (runtime) in sync.
const userSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  id: z.string(),
  updatedAt: z.string().nullable(),
});

const authResponseSchema = z.object({ user: userSchema });

type Credentials = { email: string; password: string };

const AUTH_KEY = ['auth', 'me'] as const;

function useAuth() {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryFn: async () => {
      const data = await api('/auth/me', authResponseSchema);
      return data.user;
    },
    queryKey: AUTH_KEY,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      api('/auth/login', authResponseSchema, {
        body: { email, password },
        method: 'POST',
      }).then((d) => d.user),
    onSuccess: (data) => queryClient.setQueryData(AUTH_KEY, data),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.setQueryData(AUTH_KEY, null),
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      api('/auth/register', authResponseSchema, {
        body: { email, password },
        method: 'POST',
      }).then((d) => d.user),
    onSuccess: (data) => queryClient.setQueryData(AUTH_KEY, data),
  });

  return {
    isLoading,
    login: (email: string, password: string) =>
      loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
    register: (email: string, password: string) =>
      registerMutation.mutateAsync({ email, password }),
    user,
  };
}

export { useAuth };
