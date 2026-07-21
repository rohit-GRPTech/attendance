import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export interface RecordDto {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string;
}

export interface RecordListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  filters?: Array<{ fieldKey: string; operator: string; value?: unknown }>;
}

export interface RecordListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function buildQuery(params: RecordListParams): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);
  if (params.direction) qs.set('direction', params.direction);
  if (params.filters?.length) qs.set('filters', JSON.stringify(params.filters));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function useRecords(appId: string | undefined, entityKey: string | undefined, params: RecordListParams = {}) {
  const { workspace } = useAuth();
  return useQuery({
    queryKey: ['records', workspace?.slug, appId, entityKey, params],
    queryFn: () => api.get<RecordDto[]>(`/applications/${appId}/entities/${entityKey}/records${buildQuery(params)}`),
    enabled: Boolean(workspace && appId && entityKey),
  });
}

export function useRecordMutations(appId: string, entityKey: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['records'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<RecordDto>(`/applications/${appId}/entities/${entityKey}/records`, { data }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<RecordDto>(`/applications/${appId}/entities/${entityKey}/records/${id}`, { data }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/applications/${appId}/entities/${entityKey}/records/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
