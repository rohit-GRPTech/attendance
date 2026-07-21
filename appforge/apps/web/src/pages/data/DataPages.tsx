import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Database, Filter, Plus, X } from 'lucide-react';
import { FILTER_OPERATORS, type FilterOperator } from '@appforge/shared';
import { routes } from '@/routes';
import { titleCase } from '@/lib/utils';
import { useApplication, useApplications } from '@/features/applications/api';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, EmptyState, ErrorState, PageSkeleton } from '@/components/ui/surfaces';
import { Breadcrumbs, Tabs } from '@/components/ui/overlays';
import { DynamicIcon } from '@/components/ui/icon';
import { RecordsTable } from '@/runtime/RecordsTable';
import { useRecords } from '@/features/records/api';
import { DataTable } from '@/components/ui/data-table';
import { formatCellValue } from '@/runtime/RecordsTable';

/** Data hub: choose an application to manage its business data. */
export function DataHubPage() {
  const navigate = useNavigate();
  const apps = useApplications();
  if (apps.isLoading) return <PageSkeleton />;
  if (apps.isError) return <ErrorState message="We could not load your applications." onRetry={() => apps.refetch()} />;
  const rows = apps.data?.data ?? [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Business data</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Browse and manage the records stored in each application.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Database />} title="No applications" description="Create an application first — its data tables will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((app) => (
            <Card key={app.id} className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <DynamicIcon name={app.icon} className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{app.name}</h3>
                  <p className="text-xs text-muted-foreground">{app.entityCount} data tables</p>
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate(routes.appData(app.id))}>
                Manage data
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface FilterRow {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value: string;
}

/** Per-application data management with an advanced filter builder. */
export function AppDataPage() {
  const { appId = '' } = useParams();
  const navigate = useNavigate();
  const app = useApplication(appId);
  const [entityKey, setEntityKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const definition = app.data?.data.definition;
  const entity = useMemo(
    () => definition?.entities.find((e) => e.key === (entityKey ?? definition.entities[0]?.key)),
    [definition, entityKey],
  );

  const appliedFilters = filters
    .filter((f) => f.fieldKey && (f.value !== '' || ['is_empty', 'is_not_empty'].includes(f.operator)))
    .map((f) => ({ fieldKey: f.fieldKey, operator: f.operator, value: f.value }));

  const filtered = useRecords(appId, showFilters && appliedFilters.length > 0 ? entity?.key : undefined, {
    pageSize: 50,
    filters: appliedFilters,
  });

  if (app.isLoading) return <PageSkeleton />;
  if (app.isError || !definition) return <ErrorState message="We could not load this application." onRetry={() => app.refetch()} />;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Data', onClick: () => navigate(routes.data) },
          { label: definition.app.name },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{definition.app.name} — data</h1>
        <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
          <Filter /> {showFilters ? 'Hide advanced filters' : 'Advanced filters'}
        </Button>
      </div>

      {definition.entities.length === 0 ? (
        <EmptyState icon={<Database />} title="No data tables" description="Add data tables in the builder to store records." />
      ) : (
        <>
          <Tabs
            tabs={definition.entities.map((e) => ({ value: e.key, label: e.pluralName }))}
            value={entity?.key ?? ''}
            onChange={(v) => { setEntityKey(v); setFilters([]); }}
          />

          {showFilters && entity && (
            <Card className="space-y-2 p-4">
              {filters.map((filter) => (
                <div key={filter.id} className="flex flex-wrap items-center gap-2">
                  <Select
                    className="w-44"
                    value={filter.fieldKey}
                    aria-label="Filter field"
                    onChange={(e) => setFilters((fs) => fs.map((f) => (f.id === filter.id ? { ...f, fieldKey: e.target.value } : f)))}
                  >
                    <option value="">Choose field…</option>
                    {entity.fields.map((f) => <option key={f.id} value={f.key}>{f.label}</option>)}
                  </Select>
                  <Select
                    className="w-44"
                    value={filter.operator}
                    aria-label="Filter operator"
                    onChange={(e) => setFilters((fs) => fs.map((f) => (f.id === filter.id ? { ...f, operator: e.target.value as FilterOperator } : f)))}
                  >
                    {FILTER_OPERATORS.map((op) => <option key={op} value={op}>{titleCase(op)}</option>)}
                  </Select>
                  {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
                    <Input
                      className="w-44"
                      value={filter.value}
                      aria-label="Filter value"
                      onChange={(e) => setFilters((fs) => fs.map((f) => (f.id === filter.id ? { ...f, value: e.target.value } : f)))}
                    />
                  )}
                  <Button variant="ghost" size="iconSm" aria-label="Remove filter" onClick={() => setFilters((fs) => fs.filter((f) => f.id !== filter.id))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters((fs) => [...fs, { id: crypto.randomUUID(), fieldKey: '', operator: 'eq', value: '' }])}
              >
                <Plus /> Add condition
              </Button>

              {appliedFilters.length > 0 && (
                <div className="border-t pt-3">
                  <p className="mb-2 text-sm font-medium">{(filtered.data?.data ?? []).length} matching records</p>
                  <DataTable
                    columns={entity.fields.slice(0, 5).map((f) => ({
                      key: f.key,
                      header: f.label,
                      render: (row: { data: Record<string, unknown> }) => formatCellValue(entity, f.key, row.data[f.key]),
                    }))}
                    rows={(filtered.data?.data ?? []) as never[]}
                    loading={filtered.isLoading}
                  />
                </div>
              )}
            </Card>
          )}

          {entity && <RecordsTable appId={appId} entity={entity} definition={definition} pageSize={15} />}
        </>
      )}
    </div>
  );
}
