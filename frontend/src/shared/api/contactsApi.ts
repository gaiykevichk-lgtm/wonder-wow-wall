import { useMutation } from '@tanstack/react-query';
import { api } from './client';
import type { ApiContactRequest, ApiCalculatorRequest } from './types';

export function useSubmitContact() {
  return useMutation({
    mutationFn: (body: ApiContactRequest) =>
      api.post<{ status: string; message: string }>('/contacts', body),
  });
}

export function useCalculator() {
  return useMutation({
    mutationFn: (body: ApiCalculatorRequest) =>
      api.post<{ base_panels: number; overlays: number; total: number }>('/calculator', body),
  });
}
