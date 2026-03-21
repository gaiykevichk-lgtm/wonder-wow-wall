import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api';
import type { ApiProject, ApiProjectRequest } from '../../../shared/api/types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const projectKeys = {
  list: () => ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => api.get<ApiProject[]>('/projects'),
    retry: false,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api.get<ApiProject>(`/projects/${id}`),
    enabled: !!id,
    retry: false,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiProjectRequest) =>
      api.post<ApiProject>('/projects', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ApiProjectRequest & { id: string }) =>
      api.put<ApiProject>(`/projects/${id}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: projectKeys.list() });
      qc.invalidateQueries({ queryKey: projectKeys.detail(vars.id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}
