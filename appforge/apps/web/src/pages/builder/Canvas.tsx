import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import type { ComponentNode, PageDef } from '@appforge/shared';
import { getComponentDescriptor } from '@appforge/shared';
import { cn, titleCase } from '@/lib/utils';
import type { BuilderState } from '@/features/builder/useBuilderState';
import { Badge } from '@/components/ui/surfaces';
import { DynamicIcon } from '@/components/ui/icon';

/**
 * Builder canvas: structural preview of the page with selection outlines,
 * drag-to-reorder (top level), duplicate and remove. Intentionally does NOT
 * fetch data — the runtime renderer is a separate engine.
 */
export function BuilderCanvas({ state, page, viewport }: { state: BuilderState; page: PageDef; viewport: 'desktop' | 'tablet' | 'mobile' }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = page.components.findIndex((c) => c.id === active.id);
    const to = page.components.findIndex((c) => c.id === over.id);
    if (from >= 0 && to >= 0) state.moveComponent(page.id, from, to);
  };

  const widths = { desktop: 'max-w-none', tablet: 'max-w-[768px]', mobile: 'max-w-[390px]' };

  return (
    <div className="flex-1 overflow-auto bg-muted/40 p-4 sm:p-6" onClick={() => state.selectComponent(null)}>
      <div className={cn('mx-auto min-h-full rounded-lg border bg-background p-4 shadow-card transition-all sm:p-6', widths[viewport])}>
        {page.components.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">This page is empty</p>
            <p>Open the <strong>Components</strong> tab and click a component to add it here.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={page.components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {page.components.map((node) => (
                  <SortableComponent key={node.id} state={state} page={page} node={node} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableComponent({ state, page, node }: { state: BuilderState; page: PageDef; node: ComponentNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const selected = state.selectedComponentId === node.id;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative rounded-md border bg-card transition-shadow',
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-transparent hover:border-border',
        isDragging && 'z-10 opacity-80 shadow-overlay',
      )}
      onClick={(e) => {
        e.stopPropagation();
        state.selectComponent(node.id);
      }}
    >
      <div
        className={cn(
          'absolute -top-3 left-2 z-10 flex items-center gap-1 rounded-md border bg-card px-1 py-0.5 opacity-0 shadow-sm transition-opacity',
          (selected || isDragging) && 'opacity-100',
          'group-hover:opacity-100',
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={`Reorder ${node.type}`}
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="text-[11px] font-medium text-muted-foreground">{getComponentDescriptor(node.type)?.label ?? node.type}</span>
        <button
          className="p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Duplicate component"
          onClick={(e) => { e.stopPropagation(); state.duplicateComponent(page.id, node.id); }}
        >
          <Copy className="size-3.5" />
        </button>
        <button
          className="p-0.5 text-muted-foreground hover:text-destructive"
          aria-label="Remove component"
          onClick={(e) => { e.stopPropagation(); state.removeComponent(page.id, node.id); }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="p-3">
        <BuilderPreview node={node} state={state} />
      </div>
    </div>
  );
}

/** Static, data-free preview of a component for the canvas. */
export function BuilderPreview({ node, state }: { node: ComponentNode; state: BuilderState }) {
  const props = node.props;
  const entity = state.definition.entities.find((e) => e.key === node.dataSource?.entityKey);
  const children = (node.children ?? []).map((child) => (
    <div key={child.id} className="rounded border border-dashed p-2" onClick={(e) => { e.stopPropagation(); state.selectComponent(child.id); }}>
      <BuilderPreview node={child} state={state} />
    </div>
  ));

  switch (node.type) {
    case 'heading': {
      const level = Number(props['level'] ?? 2);
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base'];
      return <p className={cn('font-semibold', sizes[level - 1] ?? 'text-xl')}>{String(props['text'] ?? 'Heading')}</p>;
    }
    case 'paragraph':
      return <p className="text-sm text-muted-foreground">{String(props['text'] ?? '')}</p>;
    case 'alert':
      return (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-sm">
          {String(props['title'] ?? '') && <p className="font-medium">{String(props['title'])}</p>}
          {String(props['text'] ?? '')}
        </div>
      );
    case 'button':
      return (
        <span className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          {String(props['label'] ?? 'Button')}
        </span>
      );
    case 'stat_card':
      return (
        <div>
          <p className="text-sm text-muted-foreground">{String(props['label'] ?? 'Metric')}</p>
          <p className="text-2xl font-semibold">128</p>
          <DataBindingTag entityName={entity?.pluralName} />
        </div>
      );
    case 'data_table': {
      const cols = (props['columns'] as string[] | undefined) ?? entity?.fields.slice(0, 4).map((f) => f.key) ?? ['name', 'status'];
      return (
        <div>
          <div className="overflow-hidden rounded border">
            <div className="grid border-b bg-muted/60 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
              {cols.map((c) => <span key={c} className="px-2 py-1.5">{entity?.fields.find((f) => f.key === c)?.label ?? titleCase(c)}</span>)}
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid border-b text-xs last:border-0" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
                {cols.map((c) => <span key={c} className="truncate px-2 py-1.5 text-muted-foreground">Sample {row + 1}</span>)}
              </div>
            ))}
          </div>
          <DataBindingTag entityName={entity?.pluralName} />
        </div>
      );
    }
    case 'form':
      return (
        <div className="max-w-sm space-y-2">
          {(entity?.fields.slice(0, 3) ?? [{ id: '1', label: 'Field' }, { id: '2', label: 'Field' }]).map((f) => (
            <div key={f.id}>
              <p className="mb-1 text-xs font-medium">{(f as { label: string }).label}</p>
              <div className="h-8 rounded border bg-muted/40" />
            </div>
          ))}
          <span className="inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            {String(props['submitLabel'] ?? 'Save')}
          </span>
          <DataBindingTag entityName={entity?.name} />
        </div>
      );
    case 'kanban':
      return (
        <div className="flex gap-2 overflow-hidden">
          {['To do', 'In progress', 'Done'].map((col) => (
            <div key={col} className="w-28 shrink-0 rounded bg-muted/60 p-1.5">
              <p className="mb-1 text-[11px] font-medium">{col}</p>
              <div className="space-y-1">
                <div className="h-8 rounded border bg-card" />
                <div className="h-8 rounded border bg-card" />
              </div>
            </div>
          ))}
        </div>
      );
    case 'bar_chart':
    case 'pie_chart':
    case 'line_chart':
      return (
        <div>
          {Boolean(props['title']) && <p className="mb-1 text-sm font-medium">{String(props['title'])}</p>}
          <div className="flex h-24 items-end gap-1.5 rounded border bg-muted/30 p-2">
            {[40, 65, 30, 80, 55, 70].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
            ))}
          </div>
          <DataBindingTag entityName={entity?.pluralName} />
        </div>
      );
    case 'columns': {
      const cols = Number(props['columns'] ?? 2);
      return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {children.length > 0 ? children : <div className="col-span-full rounded border border-dashed p-3 text-center text-xs text-muted-foreground">Empty columns — select and add children via properties</div>}
        </div>
      );
    }
    case 'section':
      return (
        <div className="space-y-2">
          <p className="font-medium">{String(props['title'] ?? 'Section')}</p>
          {children.length > 0 ? children : <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">Empty section</div>}
        </div>
      );
    case 'card':
    case 'container':
    case 'stack':
      return <div className="space-y-2">{children.length > 0 ? children : <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">Empty {node.type}</div>}</div>;
    case 'divider':
      return <hr />;
    case 'spacer':
      return <div className="flex h-6 items-center justify-center rounded bg-muted/40 text-[10px] text-muted-foreground">spacer</div>;
    case 'record_list':
      return (
        <div className="divide-y rounded border">
          {[1, 2, 3].map((i) => <div key={i} className="px-2 py-1.5 text-xs text-muted-foreground">Record {i}</div>)}
        </div>
      );
    default: {
      const descriptor = getComponentDescriptor(node.type);
      return (
        <div className="flex items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground">
          <DynamicIcon name={descriptor?.icon} className="size-3.5" />
          {descriptor?.label ?? node.type}
        </div>
      );
    }
  }
}

function DataBindingTag({ entityName }: { entityName?: string }) {
  return (
    <div className="mt-1.5">
      {entityName
        ? <Badge tone="primary" className="text-[10px]">Bound to {entityName}</Badge>
        : <Badge tone="warning" className="text-[10px]">No data source</Badge>}
    </div>
  );
}
