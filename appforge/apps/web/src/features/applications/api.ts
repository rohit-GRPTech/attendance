import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApplicationDefinition, ApplicationStatus, BusinessCategory, DefinitionIssue } from '@appforge/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export interface ApplicationSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: BusinessCategory;
  status: ApplicationStatus;
  pageCount: number;
  entityCount: number;
  workflowCount: number;
  roleCount: number;
  isPublished: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  definition: ApplicationDefinition;
}

export function useApplications(filters?: { search?: string; status?: string; category?: string }) {
  const { workspace } = useAuth();
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  const qs = params.toString();
  return useQuery({
    queryKey: ['applications', workspace?.slug, qs],
    queryFn: () => api.get<ApplicationSummary[]>(`/applications${qs ? `?${qs}` : ''}`),
    enabled: Boolean(workspace),
  });
}

export function useApplication(appId: string | undefined) {
  const { workspace } = useAuth();
  return useQuery({
    queryKey: ['application', workspace?.slug, appId],
    queryFn: () => api.get<ApplicationDetail>(`/applications/${appId}`),
    enabled: Boolean(workspace && appId),
  });
}

export function useInvalidateApplications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['applications'] });
    void queryClient.invalidateQueries({ queryKey: ['application'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useSaveDefinition(appId: string) {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: (definition: ApplicationDefinition) =>
      api.put<{ saved: boolean; issues: DefinitionIssue[] }>(`/applications/${appId}/definition`, definition),
    onSuccess: invalidate,
  });
}

export function usePublishApplication(appId: string) {
  const invalidate = useInvalidateApplications();
  return useMutation({
    mutationFn: () => api.post<{ version: number; issues: DefinitionIssue[] }>(`/applications/${appId}/publish`),
    onSuccess: invalidate,
  });
}
