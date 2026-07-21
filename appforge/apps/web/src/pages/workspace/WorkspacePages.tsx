import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ScrollText, Trash2, UserPlus, Users, Workflow } from 'lucide-react';
import { TENANT_ROLES, type TenantRole } from '@appforge/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDateTime, timeAgo, titleCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select } from '@/components/ui/input';
import { Avatar, Badge, Card, EmptyState, ErrorState, Modal, PageSkeleton, StatusBadge } from '@/components/ui/surfaces';
import { Pagination, Tabs, useToast } from '@/components/ui/overlays';
import { DataTable } from '@/components/ui/data-table';

// ── Users & roles ────────────────────────────────────────────────
interface MembersResponse {
  members: Array<{ membershipId: string; userId: string; fullName: string; email: string; role: TenantRole; joinedAt: string }>;
  pendingInvitations: Array<{ id: string; email: string; role: TenantRole; expiresAt: string }>;
}

export function UsersPage() {
  const { workspace } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TenantRole>('app_user');

  const members = useQuery({
    queryKey: ['members', workspace?.slug],
    queryFn: () => api.get<MembersResponse>('/tenants/current/members'),
    enabled: Boolean(workspace),
  });

  const invite = useMutation({
    mutationFn: () => api.post('/tenants/current/invitations', { email, role }),
    onSuccess: () => {
      toast.success(`Invitation sent to ${email}.`);
      setInviteOpen(false);
      setEmail('');
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not send the invitation.'),
  });

  const changeRole = useMutation({
    mutationFn: ({ membershipId, newRole }: { membershipId: string; newRole: TenantRole }) =>
      api.patch(`/tenants/current/members/${membershipId}`, { role: newRole }),
    onSuccess: () => {
      toast.success('Role updated.');
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update the role.'),
  });

  if (members.isLoading) return <PageSkeleton />;
  if (members.isError) return <ErrorState message="We could not load workspace members." onRetry={() => members.refetch()} />;
  const data = members.data!.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users & roles</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage who can access {workspace?.name} and what they can do.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}><UserPlus /> Invite user</Button>
      </div>

      <DataTable
        columns={[
          {
            key: 'fullName', header: 'Member',
            render: (m) => (
              <span className="flex items-center gap-2.5">
                <Avatar name={m.fullName} size="sm" />
                <span>
                  <span className="block font-medium">{m.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{m.email}</span>
                </span>
              </span>
            ),
          },
          {
            key: 'role', header: 'Role',
            render: (m) => (
              <Select
                className="h-8 w-44"
                value={m.role}
                aria-label={`Role for ${m.fullName}`}
                onChange={(e) => changeRole.mutate({ membershipId: m.membershipId, newRole: e.target.value as TenantRole })}
              >
                {TENANT_ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </Select>
            ),
          },
          { key: 'joinedAt', header: 'Joined', render: (m) => formatDateTime(m.joinedAt) },
        ]}
        rows={data.members.map((m) => ({ ...m, id: m.membershipId }))}
        empty={<EmptyState icon={<Users />} title="No members" />}
      />

      {data.pendingInvitations.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Pending invitations</h3>
          <ul className="space-y-2">
            {data.pendingInvitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{inv.email}</span>
                <span className="flex items-center gap-2">
                  <Badge>{titleCase(inv.role)}</Badge>
                  <span className="text-xs text-muted-foreground">expires {timeAgo(inv.expiresAt).replace(' ago', '')}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="mb-1 font-semibold">Workspace roles</h3>
        <p className="mb-3 text-sm text-muted-foreground">Application-level roles and record permissions are configured per application in the builder.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TENANT_ROLES.map((r) => (
            <div key={r} className="rounded-md border p-3">
              <p className="font-medium">{titleCase(r)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {r === 'tenant_owner' && 'Full control including billing and workspace deletion.'}
                {r === 'tenant_admin' && 'Manage members, applications, data and settings.'}
                {r === 'app_manager' && 'Build and publish applications; manage their data.'}
                {r === 'app_user' && 'Use published applications through the portal.'}
                {r === 'read_only' && 'View published applications without making changes.'}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a user"
        description="They will receive an email with a link to join this workspace."
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={() => invite.mutate()} loading={invite.isPending} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Email" required>
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />}
          </FormField>
          <FormField label="Role">
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value as TenantRole)}>
                {TENANT_ROLES.filter((r) => r !== 'tenant_owner').map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </Select>
            )}
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

// ── Automations (workflow runs) ──────────────────────────────────
interface WorkflowRunRow {
  id: string; workflowName: string; triggerType: string; status: string;
  startedAt: string; error: string | null; applicationId: string;
  steps: Array<{ nodeType: string; status: string }>;
}

export function WorkflowsOverviewPage() {
  const { workspace } = useAuth();
  const runs = useQuery({
    queryKey: ['workflow-runs-all', workspace?.slug],
    queryFn: () => api.get<WorkflowRunRow[]>('/workflows/runs'),
    enabled: Boolean(workspace),
  });

  if (runs.isLoading) return <PageSkeleton />;
  if (runs.isError) return <ErrorState message="We could not load automation history." onRetry={() => runs.refetch()} />;
  const rows = runs.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Execution history across your applications. Build automations inside each application's builder.
        </p>
      </div>
      <DataTable
        columns={[
          { key: 'workflowName', header: 'Automation', render: (r) => <span className="flex items-center gap-2 font-medium"><Workflow className="size-4 text-primary" /> {r.workflowName}</span> },
          { key: 'triggerType', header: 'Trigger', render: (r) => titleCase(r.triggerType) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'steps', header: 'Steps', render: (r) => `${r.steps.length}` },
          { key: 'startedAt', header: 'Ran', render: (r) => timeAgo(r.startedAt) },
          { key: 'error', header: 'Detail', render: (r) => r.error ? <span className="text-destructive">{r.error}</span> : '—' },
        ]}
        rows={rows}
        empty={<EmptyState icon={<Workflow />} title="No automation runs yet" description="Automations run when records change or when triggered from a button." />}
      />
    </div>
  );
}

// ── Notifications ────────────────────────────────────────────────
interface NotificationRow {
  id: string; title: string; body: string; kind: string; readAt: string | null; createdAt: string;
}

export function NotificationsPage() {
  const { workspace } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('all');

  const query = useQuery({
    queryKey: ['notifications', workspace?.slug],
    queryFn: () => api.get<NotificationRow[]>('/notifications'),
    enabled: Boolean(workspace),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: invalidate });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => { invalidate(); toast.success('All notifications marked as read.'); },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/notifications/${id}`), onSuccess: invalidate });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message="We could not load notifications." onRetry={() => query.refetch()} />;

  const all = query.data?.data ?? [];
  const rows = all.filter((n) => {
    if (tab === 'unread') return !n.readAt;
    if (tab === 'all') return true;
    return n.kind === tab;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{all.filter((n) => !n.readAt).length} unread</p>
        </div>
        <Button variant="outline" onClick={() => markAll.mutate()} loading={markAll.isPending}><CheckCheck /> Mark all as read</Button>
      </div>
      <Tabs
        tabs={[
          { value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' },
          { value: 'system', label: 'System' }, { value: 'application', label: 'Applications' },
          { value: 'workflow', label: 'Automations' }, { value: 'marketplace', label: 'Marketplace' },
          { value: 'billing', label: 'Billing' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Bell />} title="Nothing here" description="You're all caught up." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id} className={cn('flex items-start gap-3 p-4', !n.readAt && 'border-primary/30 bg-accent/30')}>
              <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  <Badge className="capitalize">{n.kind}</Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!n.readAt && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>Mark read</Button>
                )}
                <Button variant="ghost" size="iconSm" aria-label="Delete notification" onClick={() => remove.mutate(n.id)}>
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Audit logs ───────────────────────────────────────────────────
interface AuditRow {
  id: string; action: string; summary: string; userName: string | null;
  resourceType: string; ipAddress: string | null; createdAt: string;
}

export function AuditLogsPage() {
  const { workspace } = useAuth();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const query = useQuery({
    queryKey: ['audit', workspace?.slug, page, action],
    queryFn: () => api.get<AuditRow[]>(`/audit-logs?page=${page}&pageSize=25${action ? `&action=${action}` : ''}`),
    enabled: Boolean(workspace),
  });

  if (query.isError) {
    return <ErrorState message="We could not load audit logs. You may not have permission to view them." onRetry={() => query.refetch()} />;
  }
  const meta = query.data?.meta as { totalPages?: number } | undefined;
  const rows = query.data?.data ?? [];

  const exportCsv = () => {
    const lines = [
      'timestamp,user,action,summary',
      ...rows.map((r) => `"${r.createdAt}","${r.userName ?? ''}","${r.action}","${r.summary.replace(/"/g, '""')}"`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit logs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Every important action in this workspace, recorded for compliance.</p>
        </div>
        <div className="flex gap-2">
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-52" aria-label="Filter by action">
            <option value="">All actions</option>
            {['user.login', 'application.created', 'application.published', 'record.created', 'record.updated', 'record.deleted', 'workflow.executed', 'user.invited', 'template.installed', 'settings.changed'].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>
      <DataTable
        columns={[
          { key: 'createdAt', header: 'When', render: (r) => formatDateTime(r.createdAt) },
          { key: 'userName', header: 'User', render: (r) => r.userName ?? 'System' },
          { key: 'action', header: 'Action', render: (r) => <Badge>{r.action}</Badge> },
          { key: 'summary', header: 'Summary' },
          { key: 'ipAddress', header: 'IP', render: (r) => r.ipAddress ?? '—' },
        ]}
        rows={rows}
        loading={query.isLoading}
        empty={<EmptyState icon={<ScrollText />} title="No audit entries" />}
      />
      <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}
