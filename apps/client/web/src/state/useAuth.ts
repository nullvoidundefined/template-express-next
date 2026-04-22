'use client';

import { api } from '@/services/api';
import type { User } from '@repo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import posthog from 'posthog-js';
import { z } from 'zod';

export type { User };

// Runtime schema mirrors the User type from @repo/types.
const userSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  id: z.string(),
  updatedAt: z.string().nullable(),
});

const authResponseSchema = z.object({ user: userSchema });

type Credentials = { email: string; password: string };
type ForgotPasswordInput = { email: string };
type ResetPasswordInput = { password: string; token: string };
type UpdateMeInput = { currentPassword?: string; newPassword?: string };

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
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_KEY, data);
      posthog.identify(data.id, { email: data.email });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_KEY, null);
      posthog.reset();
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      api('/auth/register', authResponseSchema, {
        body: { email, password },
        method: 'POST',
      }).then((d) => d.user),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_KEY, data);
      posthog.identify(data.id, { email: data.email });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: ({ email }: ForgotPasswordInput) =>
      api('/auth/forgot-password', { body: { email }, method: 'POST' }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ password, token }: ResetPasswordInput) =>
      api('/auth/reset-password', {
        body: { password, token },
        method: 'POST',
      }),
  });

  const updateMeMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: UpdateMeInput) =>
      api('/auth/me', authResponseSchema, {
        body: { currentPassword, newPassword },
        method: 'PATCH',
      }).then((d) => d.user),
    onSuccess: (data) => queryClient.setQueryData(AUTH_KEY, data),
  });

  return {
    forgotPassword: (email: string) =>
      forgotPasswordMutation.mutateAsync({ email }),
    isLoading,
    login: (email: string, password: string) =>
      loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
    register: (email: string, password: string) =>
      registerMutation.mutateAsync({ email, password }),
    resetPassword: (token: string, password: string) =>
      resetPasswordMutation.mutateAsync({ password, token }),
    updateMe: (input: UpdateMeInput) => updateMeMutation.mutateAsync(input),
    user,
  };
}

export { useAuth };
