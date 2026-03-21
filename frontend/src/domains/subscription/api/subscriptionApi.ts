import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api';
import type { ApiPlan, ApiSubscription } from '../../../shared/api/types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const subscriptionKeys = {
  plans: () => ['subscription', 'plans'] as const,
  status: () => ['subscription', 'status'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans(),
    queryFn: () => api.get<ApiPlan[]>('/subscriptions/plans'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: subscriptionKeys.status(),
    queryFn: () => api.get<ApiSubscription | null>('/subscriptions/status'),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      api.post<ApiSubscription>('/subscriptions', { plan_id: planId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subscriptionKeys.status() });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/subscriptions'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subscriptionKeys.status() });
    },
  });
}
