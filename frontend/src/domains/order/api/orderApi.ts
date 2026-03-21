import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api';
import type { ApiOrder, ApiCreateOrderRequest } from '../../../shared/api/types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const orderKeys = {
  list: () => ['orders'] as const,
  detail: (id: string) => ['orders', id] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useOrders() {
  return useQuery({
    queryKey: orderKeys.list(),
    queryFn: () => api.get<ApiOrder[]>('/orders'),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => api.get<ApiOrder>(`/orders/${id}`),
    enabled: !!id,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiCreateOrderRequest) =>
      api.post<ApiOrder>('/orders', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.list() });
    },
  });
}

export function useCalculateWallCost() {
  return useMutation({
    mutationFn: (body: { panels: Record<string, unknown>[]; has_subscription?: boolean }) =>
      api.post<{ base_panels: number; overlays: number; total: number }>('/orders/calculate', body),
  });
}
