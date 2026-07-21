import type { ComponentNode } from '@appforge/shared';
import { getComponentDescriptor } from '@appforge/shared';
import { titleCase } from '@/lib/utils';
import type { BuilderState } from '@/features/builder/useBuilderState';
import { FormField, Input, Select, Switch, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/surfaces';
import { DynamicIcon } from '@/components/ui/icon';

function findComponent(nodes: ComponentNode[], id: string): ComponentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findComponent(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Right-hand properties panel: edits the selected component's props, data
 * binding and primary action. Prop editors are inferred from the descriptor's
 * default props (string/number/boolean/array) plus known enumerations.
 */
export function PropertiesPanel({ state }: { state: BuilderState }) {
  const page = state.definition.pages.find((p) => p.id === state.selectedPageId);
  const node = page && state.selectedComponentId ? findComponent(page.components, state.selectedComponentId) : null;

  if (!page || !node) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Nothing selected</p>
        <p className="mt-1">Select a component on the canvas to edit its properties, data binding and actions.</p>
      </div>
    );
  }

  const descriptor = getComponentDescriptor(node.type);
  const setProp = (key: string, value: unknown) =>
    state.updateComponent(page.id, node.id, { props: { ...node.props, [key]: value } });

  const enumOptions: Record<string, string[]> = {
    tone: ['info', 'success', 'warning', 'danger'],
    variant: ['primary', 'secondary', 'outline', 'danger'],
    mode: ['create', 'edit'],
    gap: ['sm', 'md', 'lg'],
    size: ['sm', 'md', 'lg'],
    metric: ['count'],
  };

  const entity = state.definition.entities.find((e) => e.key === node.dataSource?.entityKey);

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center gap-2">
        <DynamicIcon name={descriptor?.icon} className="size-4 text-primary" />
        <p className="text-sm font-semibold">{descriptor?.label ?? node.type}</p>
      </div>
      <p className="text-xs text-muted-foreground">{descriptor?.description}</p>

      <div className="space-y-3 border-t pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</p>
        {Object.entries({ ...descriptor?.defaultProps, ...node.props }).map(([key, value]) => {
          const label = titleCase(key);
          if (enumOptions[key]) {
            return (
              <FormField key={key} label={label}>
                {(id) => (
                  <Select id={id} value={String(node.props[key] ?? value ?? '')} onChange={(e) => setProp(key, e.target.value)}>
                    {enumOptions[key]!.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
                  </Select>
                )}
              </FormField>
            );
          }
          if (typeof value === 'boolean') {
            return <Switch key={key} label={label} checked={Boolean(node.props[key] ?? value)} onChange={(v) => setProp(key, v)} />;
          }
          if (typeof value === 'number') {
            return (
              <FormField key={key} label={label}>
                {(id) => <Input id={id} type="number" value={String(node.props[key] ?? value)} onChange={(e) => setProp(key, Number(e.target.value))} />}
              </FormField>
            );
          }
          if (Array.isArray(value)) {
            return (
              <FormField key={key} label={label} hint="Comma separated">
                {(id) => (
                  <Input
                    id={id}
                    value={((node.props[key] as string[] | undefined) ?? (value as string[])).join(', ')}
                    onChange={(e) => setProp(key, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  />
                )}
              </FormField>
            );
          }
          const str = String(node.props[key] ?? value ?? '');
          return (
            <FormField key={key} label={label}>
              {(id) =>
                str.length > 60 || key === 'text'
                  ? <Textarea id={id} rows={3} value={str} onChange={(e) => setProp(key, e.target.value)} />
                  : <Input id={id} value={str} onChange={(e) => setProp(key, e.target.value)} />
              }
            </FormField>
          );
        })}
      </div>

      {descriptor?.usesDataSource && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data binding</p>
          <FormField label="Data table">
            {(id) => (
              <Select
                id={id}
                value={node.dataSource?.entityKey ?? ''}
                onChange={(e) =>
                  state.updateComponent(page.id, node.id, {
                    dataSource: e.target.value ? { entityKey: e.target.value } : undefined,
                  })
                }
              >
                <option value="">Not connected</option>
                {state.definition.entities.map((ent) => <option key={ent.id} value={ent.key}>{ent.pluralName}</option>)}
              </Select>
            )}
          </FormField>
          {entity && 'columns' in (descriptor?.defaultProps ?? {}) === false && node.type === 'data_table' && null}
          {entity && (node.type === 'data_table' || node.type === 'detail_view') && (
            <FormField label="Columns" hint="Comma separated field keys">
              {(id) => (
                <Input
                  id={id}
                  value={((node.props['columns'] ?? node.props['fields']) as string[] | undefined)?.join(', ') ?? ''}
                  placeholder={entity.fields.slice(0, 4).map((f) => f.key).join(', ')}
                  onChange={(e) =>
                    setProp(node.type === 'detail_view' ? 'fields' : 'columns', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
                  }
                />
              )}
            </FormField>
          )}
          {entity && (node.type === 'kanban' || node.type === 'bar_chart' || node.type === 'pie_chart') && (
            <FormField label="Group by field">
              {(id) => (
                <Select id={id} value={String(node.props['groupByFieldKey'] ?? '')} onChange={(e) => setProp('groupByFieldKey', e.target.value)}>
                  {entity.fields.filter((f) => ['select', 'status', 'boolean'].includes(f.type)).map((f) => (
                    <option key={f.id} value={f.key}>{f.label}</option>
                  ))}
                </Select>
              )}
            </FormField>
          )}
        </div>
      )}

      {(descriptor?.supportedActions.length ?? 0) > 0 && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</p>
          <FormField label="On click">
            {(id) => (
              <Select
                id={id}
                value={node.actions?.[0]?.type ?? ''}
                onChange={(e) =>
                  state.updateComponent(page.id, node.id, {
                    actions: e.target.value
                      ? [{ id: node.actions?.[0]?.id ?? crypto.randomUUID(), type: e.target.value as never }]
                      : [],
                  })
                }
              >
                <option value="">No action</option>
                {descriptor!.supportedActions.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
              </Select>
            )}
          </FormField>
          {node.actions?.[0]?.type === 'navigate' && (
            <FormField label="Go to page">
              {(id) => (
                <Select
                  id={id}
                  value={node.actions?.[0]?.targetPageId ?? ''}
                  onChange={(e) =>
                    state.updateComponent(page.id, node.id, {
                      actions: [{ ...node.actions![0]!, targetPageId: e.target.value || undefined }],
                    })
                  }
                >
                  <option value="">Choose page…</option>
                  {state.definition.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              )}
            </FormField>
          )}
          {node.actions?.[0]?.type === 'run_workflow' && (
            <FormField label="Automation">
              {(id) => (
                <Select
                  id={id}
                  value={node.actions?.[0]?.workflowId ?? ''}
                  onChange={(e) =>
                    state.updateComponent(page.id, node.id, {
                      actions: [{ ...node.actions![0]!, workflowId: e.target.value || undefined }],
                    })
                  }
                >
                  <option value="">Choose automation…</option>
                  {state.definition.workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              )}
            </FormField>
          )}
        </div>
      )}

      <div className="border-t pt-3">
        <Badge tone="outline" className="text-[10px]">id: {node.id.slice(0, 8)}…</Badge>
      </div>
    </div>
  );
}
