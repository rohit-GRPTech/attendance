import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './surfaces';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
}

/** Professional data table with sorting, loading and empty slots. Wraps for horizontal scroll on small screens. */
export function DataTable<T extends { id?: string }>({
  columns, rows, loading, sort, onSort, onRowClick, empty, rowActions,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  loading?: boolean;
  sort?: { key: string; direction: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  rowActions?: (row: T) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-4 py-2.5 font-medium text-muted-foreground', col.className)}>
                {col.sortable && onSort ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => onSort(col.key)}
                  >
                    {col.header}
                    {sort?.key === col.key
                      ? sort.direction === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                      : <ArrowUpDown className="size-3.5 opacity-40" />}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
            {rowActions && <th className="w-12 px-4 py-2.5" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {loading
            ? [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3"><Skeleton className="h-4 w-3/4" /></td>
                  ))}
                  {rowActions && <td className="px-4 py-3" />}
                </tr>
              ))
            : rows.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className={cn('border-b transition-colors last:border-0', onRowClick && 'cursor-pointer hover:bg-muted/40')}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-2.5', col.className)}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <div className="p-6">{empty ?? <p className="text-center text-sm text-muted-foreground">No results found.</p>}</div>}
    </div>
  );
}
