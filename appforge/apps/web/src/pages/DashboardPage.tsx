import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Database, LayoutGrid, Plus, Sparkles, Store, UserPlus, Users, Workflow,
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { formatCurrency, timeAgo, titleCase } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, PageSkeleton, StatusBadge } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from '@/components/ui/icon';

interface DashboardData {
  totals: {
    applications: number; publishedApplications: number; draftApplications: number;
    activeUsers: number; workflowRuns: number; records: number;
    templateSales: number; monthlyRecurringRevenueUsd: number;
  };
  statusDistribution: Array<{ status: string; count: number }>;
  recentApplications: Array<{ id: string; name: string; icon: string; status: string; updatedAt: string; pageCount: number; entityCount: number }>;
  recentActivity: Array<{ id: string; summary: string; action: string; createdAt: string }>;
  workflowPerformance: { succeeded: number; failed: number; recent: Array<{ id: string; workflowName: string; status: string; startedAt: string }> };
  recentPurchases: Array<{ id: string; templateName: string; pricePaidUsd: number; createdAt: string }>;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function DashboardPage() {
  const { workspace, session } = useAuth();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['dashboard', workspace?.slug],
    queryFn: () => api.get<DashboardData>('/dashboard'),
    enabled: Boolean(workspace),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message="We could not load your overview." onRetry={() => query.refetch()} />;
  const data = query.data!.data;

  const quickActions = [
    { label: 'Create application', icon: Plus, onClick: () => navigate(routes.newApplication) },
    { label: 'Generate with AI', icon: Sparkles, onClick: () => navigate(routes.aiGenerator) },
    { label: 'Browse marketplace', icon: Store, onClick: () => navigate(routes.marketplace) },
    { label: 'Manage data', icon: Database, onClick: () => navigate(routes.data) },
    { label: 'Invite user', icon: UserPlus, onClick: () => navigate(routes.users) },
    { label: 'View automations', icon: Workflow, onClick: () => navigate(routes.workflows) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {session?.user.fullName.split(' ')[0]}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Here's what's happening in {workspace?.name}.</p>
        </div>
        <Button onClick={() => navigate(routes.newApplication)}><Plus /> New application</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Applications" value={data.totals.applications} hint={`${data.totals.publishedApplications} published · ${data.totals.draftApplications} drafts`} />
        <Stat label="Active users" value={data.totals.activeUsers} />
        <Stat label="Records created" value={data.totals.records.toLocaleString()} />
        <Stat label="Automation runs" value={data.totals.workflowRuns} hint={`${data.workflowPerformance.failed} failed recently`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Application status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.statusDistribution.map((d) => ({ ...d, status: titleCase(d.status) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 13 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex flex-col items-start gap-2 rounded-md border p-3 text-left text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <action.icon className="size-4 text-primary" aria-hidden />
                {action.label}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Recent applications</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.recentApplications.length === 0 && (
              <EmptyState icon={<LayoutGrid />} title="No applications yet" description="Create your first application to get started." />
            )}
            {data.recentApplications.map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(routes.builder(app.id))}
                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <DynamicIcon name={app.icon} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{app.name}</span>
                  <span className="block text-xs text-muted-foreground">{app.pageCount} pages · {app.entityCount} tables</span>
                </span>
                <StatusBadge status={app.status} />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length === 0 && <p className="text-sm text-muted-foreground">Activity from your team will appear here.</p>}
            {data.recentActivity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-sm">
                <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate">{a.summary}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Marketplace performance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Template installs</p>
                <p className="text-lg font-semibold tabular-nums">{data.totals.templateSales}</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Est. monthly revenue</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(data.totals.monthlyRecurringRevenueUsd)}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Recent workflow runs</p>
              <ul className="space-y-1.5">
                {data.workflowPerformance.recent.slice(0, 4).map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <Users className="hidden" />
                      <Workflow className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{run.workflowName}</span>
                    </span>
                    <StatusBadge status={run.status} />
                  </li>
                ))}
                {data.workflowPerformance.recent.length === 0 && (
                  <li className="text-sm text-muted-foreground">No automation runs yet.</li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
