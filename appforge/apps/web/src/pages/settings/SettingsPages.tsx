import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard } from 'lucide-react';
import { PLANS, type PlanId } from '@appforge/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { cn, formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/input';
import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorState, PageSkeleton, StatusBadge } from '@/components/ui/surfaces';
import { Tabs, useToast } from '@/components/ui/overlays';

interface SubscriptionInfo {
  planId: PlanId;
  plan: (typeof PLANS)[PlanId];
  subscription: { status: string; renewsAt: string } | null;
  usage: { applications: number; users: number; records: number; aiGenerationsThisMonth: number };
}

export function SettingsPage({ initialTab = 'general' }: { initialTab?: string }) {
  const { workspace, session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(workspace?.name ?? '');

  const saveProfile = useMutation({
    mutationFn: () => api.patch('/tenants/current', { name }),
    onSuccess: () => {
      toast.success('Workspace updated. Changes appear after your next sign-in refresh.');
      void queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save settings.'),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Workspace configuration for {workspace?.name}.</p>
      </div>
      <Tabs
        tabs={[
          { value: 'general', label: 'General' },
          { value: 'billing', label: 'Plans & billing' },
          { value: 'security', label: 'Security' },
          { value: 'danger', label: 'Danger zone' },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          if (v === 'billing') navigate(routes.billing, { replace: true });
          else navigate(routes.settings, { replace: true });
        }}
      />

      {tab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle>Workspace profile</CardTitle>
            <CardDescription>Your workspace name appears in the sidebar, portal and email notifications.</CardDescription>
          </CardHeader>
          <CardContent className="max-w-md space-y-4">
            <FormField label="Workspace name">
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </FormField>
            <FormField label="Workspace URL">
              {(id) => <Input id={id} value={`/portal/${workspace?.slug ?? ''}`} disabled />}
            </FormField>
            <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending} disabled={name.trim().length < 2}>
              Save changes
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'billing' && <BillingSection />}

      {tab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Session and account protection for {session?.user.email}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Two-factor authentication</p>
                <p className="text-muted-foreground">Add a second step when signing in.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/auth/two-factor')}>Coming soon</Button>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Session length</p>
                <p className="text-muted-foreground">Sessions expire after 1 hour of inactivity and refresh automatically for 30 days.</p>
              </div>
              <StatusBadge status="active" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Audit logging</p>
                <p className="text-muted-foreground">All sign-ins and data changes are recorded.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(routes.auditLogs)}>View logs</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'danger' && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>These actions are permanent. Proceed carefully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Alert tone="danger" title="Delete workspace">
              Deleting a workspace removes all applications, data, and member access. Contact support to complete a
              deletion — this safeguard prevents accidental loss.
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BillingSection() {
  const { workspace } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['subscription', workspace?.slug],
    queryFn: () => api.get<SubscriptionInfo>('/billing/subscription'),
    enabled: Boolean(workspace),
  });

  const upgrade = useMutation({
    mutationFn: (planId: PlanId) => api.post('/billing/upgrade', { planId }),
    onSuccess: () => {
      toast.success('Plan updated.');
      void queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not change the plan.'),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message="We could not load billing information." onRetry={() => query.refetch()} />;
  const data = query.data!.data;
  const limits = data.plan.limits;

  const usageRows = [
    ['Applications', data.usage.applications, limits.applications],
    ['Users', data.usage.users, limits.users],
    ['Records', data.usage.records, limits.records],
    ['AI generations (30 days)', data.usage.aiGenerationsThisMonth, limits.aiGenerationsPerMonth],
  ] as const;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="size-4" /> Current plan: {data.plan.name}</CardTitle>
          <CardDescription>
            {data.subscription
              ? `${titleCase(data.subscription.status)} · renews ${formatDate(data.subscription.renewsAt)}`
              : 'No active subscription record.'}
            {' '}Payments are handled by a provider integration — this environment uses a billing placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {usageRows.map(([label, used, limit]) => (
              <div key={label} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {used.toLocaleString()}<span className="text-sm font-normal text-muted-foreground"> / {limit === -1 ? '∞' : limit.toLocaleString()}</span>
                </p>
                {limit !== -1 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', used / limit > 0.9 ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(PLANS) as PlanId[]).map((planId) => {
          const plan = PLANS[planId];
          const current = planId === data.planId;
          return (
            <Card key={planId} className={cn('flex flex-col p-4', current && 'border-primary ring-1 ring-primary')}>
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1 text-2xl font-semibold">
                {plan.priceMonthlyUsd === 0 ? 'Free' : formatCurrency(plan.priceMonthlyUsd)}
                {plan.priceMonthlyUsd > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted-foreground">
                <li>{plan.limits.applications === -1 ? 'Unlimited' : plan.limits.applications} applications</li>
                <li>{plan.limits.users === -1 ? 'Unlimited' : plan.limits.users} users</li>
                <li>{plan.limits.records === -1 ? 'Unlimited' : plan.limits.records.toLocaleString()} records</li>
                <li>{plan.limits.aiGenerationsPerMonth === -1 ? 'Unlimited' : plan.limits.aiGenerationsPerMonth} AI generations/mo</li>
                <li>{plan.limits.marketplacePublishing ? 'Marketplace publishing' : 'No marketplace publishing'}</li>
              </ul>
              <Button
                className="mt-3"
                variant={current ? 'outline' : 'primary'}
                disabled={current}
                loading={upgrade.isPending && upgrade.variables === planId}
                onClick={() => upgrade.mutate(planId)}
              >
                {current ? <><Check /> Current plan</> : 'Switch plan'}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
