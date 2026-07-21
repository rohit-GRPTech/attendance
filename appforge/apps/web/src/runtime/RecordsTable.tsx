import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ApplicationDefinition, EntityDef } from '@appforge/shared';
import { formatDate, titleCase } from '@/lib/utils';
import { useRecords, useRecordMutations, type RecordDto, type RecordListMeta } from '@/features/records/api';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/input';
import { Badge, ConfirmDialog, EmptyState, Modal } from '@/components/ui/surfaces';
import { Pagination, useToast } from '@/components/ui/overlays';
import { DataTable, type Column } from '@/components/ui/data-table';
import { RecordForm } from './RecordForm';

export function formatCellValue(entity: EntityDef, fieldKey: string, value: unknown): React.ReactNode {
  const field = entity.fields.find((f) => f.key === fieldKey);
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;
  if (!field) return String(value);
  switch (field.type) {
    case 'boolean':
      return value ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>;
    case 'status':
    case 'select': {
      const option = field.options?.find((o) => o.value === value);
      return <Badge tone={String(value).match(/won|paid|active|completed|received|converted/) ? 'success' : 'neutral'}>{option?.label ?? titleCase(String(value))}</Badge>;
    }
    case 'currency':
      return <span className="tabular-nums">${Number(value).toLocaleString()}</span>;
    case 'percentage':
      return <span className="tabular-nums">{Number(value)}%</span>;
    case 'date':
    case 'datetime':
      return formatDate(String(value));
    default:
      return String(value);
  }
}

/**
 * Runtime data table bound to an entity: search, sort, pagination and
 * permission-aware CRUD via modals. Used by the portal runtime, the preview
 * and the data management pages.
 */
export function RecordsTable({
  appId, entity, definition, columns, pageSize = 10, allowCreate = true, allowEdit = true, allowDelete = true, searchable = true,
}: {
  appId: string;
  entity: EntityDef;
  definition: ApplicationDefinition;
  columns?: string[];
  pageSize?: number;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  searchable?: boolean;
}) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | undefined>();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RecordDto | null>(null);
  const [deleting, setDeleting] = useState<RecordDto | null>(null);

  const query = useRecords(appId, entity.key, {
    page, pageSize, search: search || undefined,
    sort: sort?.key, direction: sort?.direction,
  });
  const mutations = useRecordMutations(appId, entity.key);
  const meta = query.data?.meta as unknown as RecordListMeta | undefined;

  const columnKeys = useMemo(
    () => (columns?.length ? columns : entity.fields.filter((f) => !f.hidden).slice(0, 6).map((f) => f.key)),
    [columns, entity],
  );

  const tableColumns: Array<Column<RecordDto>> = columnKeys.map((key) => ({
    key,
    header: entity.fields.find((f) => f.key === key)?.label ?? titleCase(key),
    sortable: true,
    render: (row) => formatCellValue(entity, key, row.data[key]),
  }));

  const exportCsv = () => {
    const rows = query.data?.data ?? [];
    const header = columnKeys.join(',');
    const lines = rows.map((r) =>
      columnKeys.map((k) => `"${String(r.data[k] ?? '').replace(/"/g, '""')}"`).join(','),
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <SearchInput
            placeholder={`Search ${entity.pluralName.toLowerCase()}…`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full sm:w-60"
            aria-label={`Search ${entity.pluralName}`}
          />
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download /> Export</Button>
          {allowCreate && <Button size="sm" onClick={() => setCreating(true)}><Plus /> New {entity.name.toLowerCase()}</Button>}
        </div>
      </div>

      <DataTable
        columns={tableColumns}
        rows={query.data?.data ?? []}
        loading={query.isLoading}
        sort={sort}
        onSort={(key) =>
          setSort((cur) => (cur?.key === key ? { key, direction: cur.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }))
        }
        onRowClick={allowEdit ? (row) => setEditing(row) : undefined}
        empty={
          <EmptyState
            title={`No ${entity.pluralName.toLowerCase()} yet`}
            description={allowCreate ? `Create your first ${entity.name.toLowerCase()} to see it here.` : undefined}
            action={allowCreate ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> New {entity.name.toLowerCase()}</Button> : undefined}
          />
        }
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            {allowEdit && <Button variant="ghost" size="iconSm" aria-label="Edit record" onClick={() => setEditing(row)}><Pencil /></Button>}
            {allowDelete && <Button variant="ghost" size="iconSm" aria-label="Delete record" onClick={() => setDeleting(row)}><Trash2 className="text-destructive" /></Button>}
          </div>
        )}
      />

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}

      <Modal open={creating} onClose={() => setCreating(false)} title={`New ${entity.name.toLowerCase()}`}>
        <RecordForm
          appId={appId}
          entity={entity}
          entities={definition.entities}
          submitting={mutations.create.isPending}
          submitLabel="Create"
          onSubmit={(data) =>
            mutations.create.mutate(data, {
              onSuccess: () => { setCreating(false); toast.success(`${entity.name} created.`); },
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create the record.'),
            })
          }
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit ${entity.name.toLowerCase()}`}>
        {editing && (
          <RecordForm
            appId={appId}
            entity={entity}
            entities={definition.entities}
            initialData={editing.data}
            submitting={mutations.update.isPending}
            submitLabel="Save changes"
            onSubmit={(data) =>
              mutations.update.mutate(
                { id: editing.id, data },
                {
                  onSuccess: () => { setEditing(null); toast.success(`${entity.name} updated.`); },
                  onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update the record.'),
                },
              )
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        loading={mutations.remove.isPending}
        onConfirm={() =>
          deleting &&
          mutations.remove.mutate(deleting.id, {
            onSuccess: () => { setDeleting(null); toast.success(`${entity.name} deleted.`); },
            onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete the record.'),
          })
        }
        title={`Delete this ${entity.name.toLowerCase()}?`}
        message="The record will be removed from all views. This action cannot be undone."
      />
    </div>
  );
}
