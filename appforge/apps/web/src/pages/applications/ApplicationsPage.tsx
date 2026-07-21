import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Archive, Copy, Database, Download, Eye, FileJson, Hammer, LayoutGrid,
  List, MoreHorizontal, Plus, Rocket, Sparkles, Trash2,
} from 'lucide-react';
import { APPLICATION_STATUSES, BUSINESS_CATEGORIES, type ApplicationDefinition } from '@appforge/shared';
import { api } from '@/lib/api';
import { routes } from '@/routes';
import { formatDate, titleCase, cn } from '@/lib/utils';
import { useApplications, useInvalidateApplications, type ApplicationSummary } from '@/features/applications/api';
import { Button } from '@/components/ui/button';
import { SearchInput, Select } from '@/components/ui/input';
import { Card, ConfirmDialog, EmptyState, ErrorState, PageSkeleton, StatusBadge } from '@/components/ui/surfaces';
import { DropdownMenu, MenuItem, MenuSeparator, useToast } from '@/components/ui/overlays';
import { DataTable } from '@/components/ui/data-table';
import { DynamicIcon } from '@/components/ui/icon';

export function ApplicationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateApplications();
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ApplicationSummary | null>(null);

  const query = useApplications({ search: search || undefined, status: status || undefined, category: category || undefined });
  const apps = useMemo(() => query.data?.data ?? [], [query.data]);

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'publish' | 'duplicate' | 'archive' | 'delete' | 'export' }) => {
      if (action === 'publish') await api.post(`/applications/${id}/publish`);
      else if (action === 'duplicate') await api.post(`/applications/${id}/duplicate`);
      else if (action === 'archive') await api.patch(`/applications/${id}`, { status: 'archived' });
      else if (action === 'delete') await api.delete(`/applications/${id}`);
      else if (action === 'export') {
        const { data } = await api.get<ApplicationDefinition>(`/applications/${id}/export`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.app.slug}-definition.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      return action;
    },
    onSuccess: (action) => {
      invalidate();
      setDeleteTarget(null);
      const messages = {
        publish: 'Application published.',
        duplicate: 'Application duplicated.',
        archive: 'Application archived.',
        delete: 'Application deleted.',
        export: 'Definition exported as JSON.',
      } as const;
      toast.success(messages[action]);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'That action failed.'),
  });

  const actionsMenu = (app: ApplicationSummary) => (
    <DropdownMenu
      trigger={<Button variant="ghost" size="iconSm" aria-label={`Actions for ${app.name}`}><MoreHorizontal /></Button>}
    >
      <MenuItem onClick={() => navigate(routes.builder(app.id))}><Hammer /> Open builder</MenuItem>
      <MenuItem onClick={() => navigate(routes.preview(app.id))}><Eye /> Preview</MenuItem>
      <MenuItem onClick={() => navigate(routes.appData(app.id))}><Database /> Manage data</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => act.mutate({ id: app.id, action: 'publish' })}><Rocket /> Publish</MenuItem>
      <MenuItem onClick={() => act.mutate({ id: app.id, action: 'duplicate' })}><Copy /> Duplicate</MenuItem>
      <MenuItem onClick={() => act.mutate({ id: app.id, action: 'export' })}><FileJson /> Export JSON</MenuItem>
      <MenuItem onClick={() => act.mutate({ id: app.id, action: 'archive' })}><Archive /> Archive</MenuItem>
      <MenuSeparator />
      <MenuItem danger onClick={() => setDeleteTarget(app)}><Trash2 /> Delete</MenuItem>
    </DropdownMenu>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Applications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Build, publish and manage your business applications.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(routes.aiGenerator)}><Sparkles /> Generate with AI</Button>
          <Button onClick={() => navigate(routes.newApplication)}><Plus /> Create application</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search applications…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" aria-label="Search applications" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" aria-label="Filter by status">
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44" aria-label="Filter by category">
          <option value="">All categories</option>
          {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
        </Select>
        <div className="ml-auto flex rounded-md border p-0.5">
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="iconSm" onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid /></Button>
          <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="iconSm" onClick={() => setView('table')} aria-label="Table view"><List /></Button>
        </div>
      </div>

      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState message="We could not load your applications." onRetry={() => query.refetch()} />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid />}
          title="No applications found"
          description={search || status || category ? 'Try adjusting your search or filters.' : 'Create your first application from scratch, with AI, or from a marketplace template.'}
          action={<Button onClick={() => navigate(routes.newApplication)}><Plus /> Create application</Button>}
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.id} className={cn('flex flex-col p-5 transition-shadow hover:shadow-md', app.status === 'archived' && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <DynamicIcon name={app.icon} className="size-5" />
                </span>
                {actionsMenu(app)}
              </div>
              <button className="mt-3 text-left" onClick={() => navigate(routes.builder(app.id))}>
                <h3 className="font-semibold hover:text-primary">{app.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{app.description || 'No description yet.'}</p>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={app.status} />
                <span>{app.pageCount} pages</span>·<span>{app.entityCount} tables</span>·<span>{app.workflowCount} automations</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>Updated {formatDate(app.updatedAt)}</span>
                <Button size="sm" variant="outline" onClick={() => navigate(routes.builder(app.id))}><Hammer /> Builder</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable
          columns={[
            {
              key: 'name', header: 'Application',
              render: (app) => (
                <span className="flex items-center gap-2.5 font-medium">
                  <DynamicIcon name={app.icon} className="size-4 text-primary" />
                  {app.name}
                </span>
              ),
            },
            { key: 'status', header: 'Status', render: (app) => <StatusBadge status={app.status} /> },
            { key: 'category', header: 'Category', render: (app) => titleCase(app.category) },
            { key: 'pageCount', header: 'Pages' },
            { key: 'entityCount', header: 'Tables' },
            { key: 'updatedAt', header: 'Updated', render: (app) => formatDate(app.updatedAt) },
          ]}
          rows={apps}
          onRowClick={(app) => navigate(routes.builder(app.id))}
          rowActions={actionsMenu}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && act.mutate({ id: deleteTarget.id, action: 'delete' })}
        loading={act.isPending}
        title={`Delete "${deleteTarget?.name}"?`}
        message="The application and its pages will be removed for everyone in this workspace. Its records are retained for recovery by support. This cannot be undone from the app."
      />
    </div>
  );
}
