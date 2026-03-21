import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api';
import type { ApiAuthResponse, ApiUserResponse } from '../../../shared/api/types';
import { useAuthStore } from '../model/authStore';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const authKeys = {
  profile: () => ['auth', 'profile'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useProfile() {
  const isAuth = useAuthStore((s) => s.isAuth);
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: () => api.get<ApiUserResponse>('/auth/me'),
    enabled: isAuth,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useLoginMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api.post<ApiAuthResponse>('/auth/login', body),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
    },
  });
}

export function useRegisterMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (body: { name: string; email: string; phone: string; password: string }) =>
      api.post<ApiAuthResponse>('/auth/register', body),
    onSuccess: (data) => {
      setAuth(data.user, data.token);
    },
  });
}

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; phone?: string }) =>
      api.patch<ApiUserResponse>('/auth/me', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
}
