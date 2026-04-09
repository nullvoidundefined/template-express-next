'use client';

import { api } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// TODO: move to @repo/types
export type User = {
  createdAt: string;
  email: string;
  id: string;
  updatedAt: string | null;
};

type AuthResponse = { user: User };

type Credentials = { email: string; password: string };

const AUTH_KEY = ['auth', 'me'] as const;

function useAuth() {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryFn: async () => {
      const data = await api<AuthResponse>('/auth/me');
      return data.user;
    },
    queryKey: AUTH_KEY,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      api<AuthResponse>('/auth/login', {
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
      api<AuthResponse>('/auth/register', {
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
