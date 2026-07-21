import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { ApplicationDefinition, ComponentNode, EntityDef, PageDef } from '@appforge/shared';
import { cn, titleCase } from '@/lib/utils';
import { api } from '@/lib/api';
import { useRecords, useRecordMutations } from '@/features/records/api';
import { Alert, Badge, Card, EmptyState, Skeleton } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { Tabs, useToast } from '@/components/ui/overlays';
import { RecordsTable, formatCellValue } from './RecordsTable';
import { RecordForm } from './RecordForm';

/**
 * Runtime engine renderer. Reads a validated application definition and
 * renders a page's component tree through the registry-backed dispatch below.
 * Strictly separated from the builder: this file never mutates definitions.
 */

export interface RuntimeContext {
  appId: string;
  definition: ApplicationDefinition;
  /** Navigate to another page of the running app (portal or preview). */
  navigateToPage?: (pageId: string) => void;
}

export function RuntimePage({ ctx, page }: { ctx: RuntimeContext; page: PageDef }) {
  return (
    <div className={cn('space-y-4', page.layout === 'two_column' && 'lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0')}>
      {page.components.map((node) => (
        <RuntimeComponent key={node.id} ctx={ctx} node={node} pageEntityKey={page.dataSource?.entityKey} />
      ))}
      {page.components.length === 0 && (
        <EmptyState title="This page is empty" description="The application builder has not added any components here yet." />
      )}
    </div>
  );
}

function entityFor(ctx: RuntimeContext, node: ComponentNode, fallbackKey?: string): EntityDef | undefined {
  const key = node.dataSource?.entityKey ?? fallbackKey;
  return ctx.definition.entities.find((e) => e.key === key);
}

export function RuntimeComponent({
  ctx, node, pageEntityKey,
}: {
  ctx: RuntimeContext; node: ComponentNode; pageEntityKey?: string;
}) {
  const props = node.props as Record<string, never>;
  const children = (node.children ?? []).map((child) => (
    <RuntimeComponent key={child.id} ctx={ctx} node={child} pageEntityKey={pageEntityKey} />
  ));

  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(props['level'] ?? 2), 1), 4);
      const Tag = `h${level}` as 'h2';
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base'];
      return <Tag className={cn('font-semibold', sizes[level - 1])}>{String(props['text'] ?? '')}</Tag>;
    }
    case 'paragraph':
      return <p className="max-w-prose text-sm text-muted-foreground">{String(props['text'] ?? '')}</p>;
    case 'alert':
      return (
        <Alert tone={(props['tone'] as never) ?? 'info'} title={props['title'] ? String(props['title']) : undefined}>
          {String(props['text'] ?? '')}
        </Alert>
      );
    case 'image':
      return props['src']
        ? <img src={String(props['src'])} alt={String(props['alt'] ?? '')} className="max-w-full rounded-md border" />
        : <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">Image placeholder</div>;
    case 'divider':
      return <hr className="border-border" />;
    case 'spacer': {
      const size = { sm: 'h-3', md: 'h-6', lg: 'h-12' }[String(props['size'] ?? 'md')] ?? 'h-6';
      return <div className={size} aria-hidden />;
    }
    case 'container':
      return <div className={cn(props['padded'] !== false && 'p-4', props['bordered'] && 'rounded-lg border', 'space-y-3')}>{children}</div>;
    case 'section':
      return (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{String(props['title'] ?? '')}</h2>
            {Boolean(props['description']) && <p className="text-sm text-muted-foreground">{String(props['description'])}</p>}
          </div>
          {children}
        </section>
      );
    case 'card':
      return (
        <Card className="p-5">
          {Boolean(props['title']) && <h3 className="mb-3 font-semibold">{String(props['title'])}</h3>}
          <div className="space-y-3">{children}</div>
        </Card>
      );
    case 'columns': {
      const cols = Math.min(Math.max(Number(props['columns'] ?? 2), 1), 4);
      const grid = ['sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3', 'sm:grid-cols-2 lg:grid-cols-4'][cols - 1];
      return <div className={cn('grid gap-4', grid)}>{children}</div>;
    }
    case 'stack': {
      const gap = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[String(props['gap'] ?? 'md')] ?? 'gap-4';
      return <div className={cn('flex flex-col', gap)}>{children}</div>;
    }
    case 'tabs':
      return <RuntimeTabs labels={(props['labels'] as string[] | undefined) ?? []} panels={children} />;

    case 'stat_card':
      return <RuntimeStatCard ctx={ctx} node={node} pageEntityKey={pageEntityKey} />;
    case 'data_table': {
      const entity = entityFor(ctx, node, pageEntityKey);
      if (!entity) return <MissingEntity />;
      return (
        <RecordsTable
          appId={ctx.appId}
          entity={entity}
          definition={ctx.definition}
          columns={props['columns'] as string[] | undefined}
          pageSize={Number(props['pageSize'] ?? 10)}
          searchable={props['searchable'] !== false}
          allowCreate={props['allowCreate'] !== false}
          allowEdit={props['allowEdit'] !== false}
          allowDelete={props['allowDelete'] !== false}
        />
      );
    }
    case 'record_list':
      return <RuntimeRecordList ctx={ctx} node={node} pageEntityKey={pageEntityKey} />;
    case 'detail_view':
      return <RuntimeDetailView ctx={ctx} node={node} pageEntityKey={pageEntityKey} />;
    case 'kanban':
      return <RuntimeKanban ctx={ctx} node={node} pageEntityKey={pageEntityKey} />;
    case 'form':
      return <RuntimeFormComponent ctx={ctx} node={node} pageEntityKey={pageEntityKey} />;
    case 'bar_chart':
    case 'pie_chart':
    case 'line_chart':
      return <RuntimeChart ctx={ctx} node={node} pageEntityKey={pageEntityKey} />;
    case 'button':
      return <RuntimeButton ctx={ctx} node={node} />;
    default:
      return (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {titleCase(node.type)} component
        </div>
      );
  }
}

function MissingEntity() {
  return <Alert tone="warning">This component is not connected to a data table yet.</Alert>;
}

function RuntimeTabs({ labels, panels }: { labels: string[]; panels: React.ReactNode[] }) {
  const tabLabels = labels.length > 0 ? labels : panels.map((_, i) => `Tab ${i + 1}`);
  const [active, setActive] = useState('0');
  return (
    <div className="space-y-3">
      <Tabs tabs={tabLabels.map((l, i) => ({ value: String(i), label: l }))} value={active} onChange={setActive} />
      <div>{panels[Number(active)] ?? <p className="text-sm text-muted-foreground">Empty tab</p>}</div>
    </div>
  );
}

function RuntimeStatCard({ ctx, node, pageEntityKey }: { ctx: RuntimeContext; node: ComponentNode; pageEntityKey?: string }) {
  const entity = entityFor(ctx, node, pageEntityKey);
  const records = useRecords(ctx.appId, entity?.key, { pageSize: 1 });
  const total = (records.data?.meta as { total?: number } | undefined)?.total;
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{String(node.props['label'] ?? entity?.pluralName ?? 'Records')}</p>
      {records.isLoading ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="mt-1 text-2xl font-semibold tabular-nums">{total ?? 0}</p>}
    </Card>
  );
}

function RuntimeRecordList({ ctx, node, pageEntityKey }: { ctx: RuntimeContext; node: ComponentNode; pageEntityKey?: string }) {
  const entity = entityFor(ctx, node, pageEntityKey);
  const records = useRecords(ctx.appId, entity?.key, { pageSize: Number(node.props['limit'] ?? 10) });
  if (!entity) return <MissingEntity />;
  return (
    <Card className="divide-y">
      {(records.data?.data ?? []).map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="truncate font-medium">{String(r.data[entity.displayFieldKey] ?? r.id)}</span>
          <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
        </div>
      ))}
      {!records.isLoading && (records.data?.data ?? []).length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No {entity.pluralName.toLowerCase()} yet.</p>
      )}
    </Card>
  );
}

function RuntimeDetailView({ ctx, node, pageEntityKey }: { ctx: RuntimeContext; node: ComponentNode; pageEntityKey?: string }) {
  const entity = entityFor(ctx, node, pageEntityKey);
  const records = useRecords(ctx.appId, entity?.key, { pageSize: 1 });
  const record = records.data?.data[0];
  if (!entity) return <MissingEntity />;
  if (!record) return <EmptyState title={`No ${entity.name.toLowerCase()} to display`} />;
  const fieldKeys = (node.props['fields'] as string[] | undefined) ?? entity.fields.map((f) => f.key);
  return (
    <Card className="p-5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {fieldKeys.map((key) => (
          <div key={key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {entity.fields.find((f) => f.key === key)?.label ?? titleCase(key)}
            </dt>
            <dd className="mt-0.5 text-sm">{formatCellValue(entity, key, record.data[key])}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function RuntimeKanban({ ctx, node, pageEntityKey }: { ctx: RuntimeContext; node: ComponentNode; pageEntityKey?: string }) {
  const entity = entityFor(ctx, node, pageEntityKey);
  const records = useRecords(ctx.appId, entity?.key, { pageSize: 100 });
  if (!entity) return <MissingEntity />;
  const groupKey = String(node.props['groupByFieldKey'] ?? 'status');
  const field = entity.fields.find((f) => f.key === groupKey);
  const groups = field?.options?.map((o) => ({ value: o.value, label: o.label })) ?? [{ value: '', label: 'All' }];
  const rows = records.data?.data ?? [];
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {groups.map((group) => {
          const cards = rows.filter((r) => (group.value === '' ? true : String(r.data[groupKey] ?? '') === group.value));
          return (
            <div key={group.value || 'all'} className="w-64 shrink-0 rounded-lg bg-muted/60 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-medium">{group.label}</p>
                <Badge>{cards.length}</Badge>
              </div>
              <div className="space-y-2">
                {cards.map((card) => (
                  <Card key={card.id} className="p-3 text-sm">
                    <p className="font-medium">{String(card.data[entity.displayFieldKey] ?? card.id)}</p>
                    {entity.fields.slice(0, 3).filter((f) => f.key !== entity.displayFieldKey && f.key !== groupKey).slice(0, 2).map((f) => (
                      <p key={f.key} className="mt-0.5 truncate text-xs text-muted-foreground">
                        {f.label}: {String(card.data[f.key] ?? '—')}
                      </p>
                    ))}
                  </Card>
                ))}
                {cards.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RuntimeFormComponent({ ctx, node, pageEntityKey }: { ctx: RuntimeContext; node: ComponentNode; pageEntityKey?: string }) {
  const toast = useToast();
  const entity = entityFor(ctx, node, pageEntityKey);
  const mutations = useRecordMutations(ctx.appId, entity?.key ?? '');
  const [submitted, setSubmitted] = useState(false);
  if (!entity) return <MissingEntity />;
  if (submitted) {
    return (
      <Alert tone="success" title="Thank you!">
        Your {entity.name.toLowerCase()} was submitted.{' '}
        <button className="underline" onClick={() => setSubmitted(false)}>Submit another</button>
      </Alert>
    );
  }
  return (
    <Card className="max-w-xl p-5">
      <RecordForm
        appId={ctx.appId}
        entity={entity}
        entities={ctx.definition.entities}
        fields={node.props['fields'] as string[] | undefined}
        submitLabel={String(node.props['submitLabel'] ?? 'Save')}
        submitting={mutations.create.isPending}
        onSubmit={(data) =>
          mutations.create.mutate(data, {
            onSuccess: () => setSubmitted(true),
            onError: (err) => toast.error(err instanceof Error ? err.message : 'Submission failed.'),
          })
        }
      />
    </Card>
  );
}

const CHART_COLORS = ['hsl(243 75% 59%)', 'hsl(199 89% 48%)', 'hsl(152 60% 40%)', 'hsl(36 92% 50%)', 'hsl(0 72% 55%)', 'hsl(280 60% 55%)'];

function RuntimeChart({ ctx, node, pageEntityKey }: { ctx: RuntimeContext; node: ComponentNode; pageEntityKey?: string }) {
  const entity = entityFor(ctx, node, pageEntityKey);
  const records = useRecords(ctx.appId, entity?.key, { pageSize: 100 });
  const groupKey = String(node.props['groupByFieldKey'] ?? 'status');
  const data = useMemo(() => {
    const rows = records.data?.data ?? [];
    if (node.type === 'line_chart') {
      const byDay = new Map<string, number>();
      for (const r of rows) {
        const day = r.createdAt.slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
      return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
    }
    const counts = new Map<string, number>();
    for (const r of rows) {
      const raw = String(r.data[groupKey] ?? 'None');
      const field = entity?.fields.find((f) => f.key === groupKey);
      const label = field?.options?.find((o) => o.value === raw)?.label ?? titleCase(raw);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [records.data, groupKey, node.type, entity]);

  if (!entity) return <MissingEntity />;
  const title = node.props['title'] ? String(node.props['title']) : undefined;
  return (
    <Card className="p-5">
      {title && <h3 className="mb-3 font-semibold">{title}</h3>}
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No data to chart yet.</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            {node.type === 'pie_chart' ? (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <ChartTooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            ) : node.type === 'line_chart' ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={28} />
                <ChartTooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={28} />
                <ChartTooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function RuntimeButton({ ctx, node }: { ctx: RuntimeContext; node: ComponentNode }) {
  const toast = useToast();
  const navigate = useNavigate();
  const action = node.actions?.[0];
  const variant = ({ primary: 'primary', secondary: 'secondary', outline: 'outline', danger: 'danger' } as const)[
    String(node.props['variant'] ?? 'primary')
  ] ?? 'primary';

  const run = async () => {
    if (!action) {
      toast.error('This button has no action configured yet.');
      return;
    }
    if (action.type === 'navigate' && action.targetPageId) {
      ctx.navigateToPage ? ctx.navigateToPage(action.targetPageId) : navigate('#');
    } else if (action.type === 'run_workflow' && action.workflowId) {
      try {
        await api.post(`/workflows/applications/${ctx.appId}/workflows/${action.workflowId}/run`);
        toast.success('Automation started.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Automation failed.');
      }
    } else {
      toast.success(`${titleCase(action.type)} action triggered.`);
    }
  };

  return <Button variant={variant} onClick={run}>{String(node.props['label'] ?? 'Button')}</Button>;
}
