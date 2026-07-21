import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Plus, Trash2, Pencil, EyeOff, Workflow as WorkflowIcon } from 'lucide-react';
import {
  componentsByCategory, FIELD_TYPES, PAGE_TYPES,
  type EntityDef, type EntityFieldDef, type PageDef,
} from '@appforge/shared';
import { cn, titleCase } from '@/lib/utils';
import { routes } from '@/routes';
import type { BuilderState } from '@/features/builder/useBuilderState';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select, Checkbox, Switch } from '@/components/ui/input';
import { Badge, Modal, StatusBadge } from '@/components/ui/surfaces';
import { DynamicIcon } from '@/components/ui/icon';

// ── Pages panel ──────────────────────────────────────────────────
export function PagesPanel({ state }: { state: BuilderState }) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<PageDef['type']>('custom');

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Pages</p>
        <Button variant="ghost" size="iconSm" onClick={() => setAddOpen(true)} aria-label="Add page"><Plus /></Button>
      </div>
      <ul className="space-y-0.5">
        {state.definition.pages.map((page) => (
          <li key={page.id}>
            <button
              onClick={() => state.selectPage(page.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                state.selectedPageId === page.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
              )}
            >
              <DynamicIcon name={page.icon} className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{page.name}</span>
              {page.isHome && <Home className="size-3 text-muted-foreground" aria-label="Home page" />}
              {!page.showInNavigation && <EyeOff className="size-3 text-muted-foreground" aria-label="Hidden from navigation" />}
            </button>
          </li>
        ))}
      </ul>
      {state.selectedPageId && <PageSettings state={state} />}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a page"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => { state.addPage(name, type); setAddOpen(false); setName(''); }} disabled={name.trim().length < 2}>
              Add page
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Page name" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Customers" />}</FormField>
          <FormField label="Page type">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as PageDef['type'])}>
                {PAGE_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </Select>
            )}
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

function PageSettings({ state }: { state: BuilderState }) {
  const page = state.definition.pages.find((p) => p.id === state.selectedPageId);
  if (!page) return null;
  return (
    <div className="mt-4 space-y-3 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Page settings</p>
      <FormField label="Name">{(id) => <Input id={id} value={page.name} onChange={(e) => state.updatePage(page.id, { name: e.target.value })} />}</FormField>
      <FormField label="Data source">
        {(id) => (
          <Select
            id={id}
            value={page.dataSource?.entityKey ?? ''}
            onChange={(e) => state.updatePage(page.id, { dataSource: e.target.value ? { entityKey: e.target.value } : undefined })}
          >
            <option value="">None</option>
            {state.definition.entities.map((ent) => <option key={ent.id} value={ent.key}>{ent.pluralName}</option>)}
          </Select>
        )}
      </FormField>
      <Switch label="Show in navigation" checked={page.showInNavigation} onChange={(v) => state.updatePage(page.id, { showInNavigation: v })} />
      <Switch label="Set as home page" checked={Boolean(page.isHome)} onChange={(v) => state.updatePage(page.id, { isHome: v })} />
      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive"
        disabled={state.definition.pages.length <= 1}
        onClick={() => state.removePage(page.id)}
      >
        <Trash2 /> Delete page
      </Button>
    </div>
  );
}

// ── Components panel ─────────────────────────────────────────────
export function ComponentsPanel({ state }: { state: BuilderState }) {
  const categories = componentsByCategory();
  const labels = { layout: 'Layout', data: 'Data display', form: 'Forms', content: 'Content', chart: 'Charts', action: 'Actions' } as const;
  return (
    <div className="space-y-4 p-3">
      <p className="text-sm text-muted-foreground">Click a component to add it to the current page, then drag to reorder on the canvas.</p>
      {(Object.keys(categories) as Array<keyof typeof categories>).map((category) => (
        <div key={category}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels[category]}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {categories[category].map((descriptor) => (
              <button
                key={descriptor.type}
                onClick={() => state.selectedPageId && state.addComponent(state.selectedPageId, descriptor.type)}
                disabled={!state.selectedPageId}
                title={descriptor.description}
                className="flex flex-col items-start gap-1 rounded-md border p-2 text-left text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-50"
              >
                <DynamicIcon name={descriptor.icon} className="size-4 text-primary" />
                {descriptor.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Data (entity designer) panel ─────────────────────────────────
export function DataPanel({ state }: { state: BuilderState }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EntityDef | null>(null);
  const [name, setName] = useState('');
  const [plural, setPlural] = useState('');

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Data tables</p>
        <Button variant="ghost" size="iconSm" onClick={() => setAddOpen(true)} aria-label="Add data table"><Plus /></Button>
      </div>
      <ul className="space-y-1">
        {state.definition.entities.map((entity) => (
          <li key={entity.id} className="rounded-md border p-2.5">
            <div className="flex items-center gap-2">
              <DynamicIcon name={entity.icon} className="size-4 text-primary" />
              <span className="flex-1 truncate text-sm font-medium">{entity.pluralName}</span>
              <Button variant="ghost" size="iconSm" aria-label={`Edit ${entity.name}`} onClick={() => setEditing(entity)}><Pencil /></Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{entity.fields.length} fields · key: {entity.key}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {entity.fields.slice(0, 5).map((f) => <Badge key={f.id} className="text-[10px]">{f.label}</Badge>)}
              {entity.fields.length > 5 && <Badge className="text-[10px]">+{entity.fields.length - 5}</Badge>}
            </div>
          </li>
        ))}
        {state.definition.entities.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No data tables yet. Add one to store business records.
          </p>
        )}
      </ul>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="New data table"
        description="A data table stores one kind of business record, like customers or invoices."
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => { state.addEntity(name, plural || `${name}s`); setAddOpen(false); setName(''); setPlural(''); }}
              disabled={name.trim().length < 2}
            >
              Create table
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Singular name" required hint='For example "Customer"'>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Plural name" hint='For example "Customers"'>
            {(id) => <Input id={id} value={plural} onChange={(e) => setPlural(e.target.value)} placeholder={name ? `${name}s` : ''} />}
          </FormField>
        </div>
      </Modal>

      {editing && <EntityEditor state={state} entityId={editing.id} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EntityEditor({ state, entityId, onClose }: { state: BuilderState; entityId: string; onClose: () => void }) {
  const entity = state.definition.entities.find((e) => e.id === entityId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!entity) return null;

  const updateField = (fieldId: string, patch: Partial<EntityFieldDef>) => {
    state.updateEntity(entityId, {
      fields: entity.fields.map((f) => (f.id === fieldId ? { ...f, ...patch, id: f.id } : f)),
    });
  };

  const addField = () => {
    const n = entity.fields.length + 1;
    state.updateEntity(entityId, {
      fields: [
        ...entity.fields,
        { id: crypto.randomUUID(), key: `field_${n}`, label: `New field ${n}`, type: 'short_text' },
      ],
    });
  };

  const removeField = (fieldId: string) => {
    state.updateEntity(entityId, { fields: entity.fields.filter((f) => f.id !== fieldId) });
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${entity.name}`} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Singular name">{(id) => <Input id={id} value={entity.name} onChange={(e) => state.updateEntity(entityId, { name: e.target.value })} />}</FormField>
          <FormField label="Plural name">{(id) => <Input id={id} value={entity.pluralName} onChange={(e) => state.updateEntity(entityId, { pluralName: e.target.value })} />}</FormField>
          <FormField label="Display field" hint="Used as the record title.">
            {(id) => (
              <Select id={id} value={entity.displayFieldKey} onChange={(e) => state.updateEntity(entityId, { displayFieldKey: e.target.value })}>
                {entity.fields.map((f) => <option key={f.id} value={f.key}>{f.label}</option>)}
              </Select>
            )}
          </FormField>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Fields</p>
            <Button variant="outline" size="sm" onClick={addField}><Plus /> Add field</Button>
          </div>
          <div className="space-y-2">
            {entity.fields.map((field) => (
              <div key={field.id} className="rounded-md border p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_150px_auto]">
                  <Input aria-label="Field label" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} />
                  <Input
                    aria-label="Field key"
                    value={field.key}
                    onChange={(e) => updateField(field.id, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  />
                  <Select aria-label="Field type" value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as EntityFieldDef['type'] })}>
                    {FIELD_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                  </Select>
                  <Button variant="ghost" size="iconSm" aria-label={`Remove ${field.label}`} onClick={() => removeField(field.id)} disabled={entity.fields.length <= 1}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  <Checkbox label="Required" checked={Boolean(field.required)} onChange={(v) => updateField(field.id, { required: v })} />
                  <Checkbox label="Unique" checked={Boolean(field.unique)} onChange={(v) => updateField(field.id, { unique: v })} />
                  <Checkbox label="Hidden" checked={Boolean(field.hidden)} onChange={(v) => updateField(field.id, { hidden: v })} />
                  {(field.type === 'select' || field.type === 'multi_select' || field.type === 'status') && (
                    <Input
                      aria-label="Options (comma separated)"
                      className="h-8 w-64"
                      placeholder="Options, comma separated"
                      value={(field.options ?? []).map((o) => o.label).join(', ')}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'opt', label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_') })),
                        })
                      }
                    />
                  )}
                  {field.type === 'relation' && (
                    <Select
                      aria-label="Related table"
                      className="h-8 w-48"
                      value={field.relation?.targetEntityKey ?? ''}
                      onChange={(e) =>
                        updateField(field.id, {
                          relation: e.target.value ? { kind: 'many_to_one', targetEntityKey: e.target.value } : undefined,
                        })
                      }
                    >
                      <option value="">Choose table…</option>
                      {state.definition.entities.filter((e2) => e2.id !== entityId).map((e2) => (
                        <option key={e2.id} value={e2.key}>{e2.pluralName}</option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-destructive">Delete this table and its configuration?</span>
              <Button variant="danger" size="sm" onClick={() => { state.removeEntity(entityId); onClose(); }}>Confirm delete</Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete table
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Workflows panel ──────────────────────────────────────────────
export function WorkflowsPanel({ state, appId }: { state: BuilderState; appId: string }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Automations</p>
        <Button
          variant="ghost"
          size="iconSm"
          aria-label="Add automation"
          onClick={() => {
            const id = state.addWorkflow(`Automation ${state.definition.workflows.length + 1}`);
            navigate(routes.builderWorkflow(appId, id));
          }}
        >
          <Plus />
        </Button>
      </div>
      <ul className="space-y-1">
        {state.definition.workflows.map((wf) => (
          <li key={wf.id}>
            <button
              onClick={() => navigate(routes.builderWorkflow(appId, wf.id))}
              className="flex w-full items-center gap-2 rounded-md border p-2.5 text-left text-sm hover:border-primary/40"
            >
              <WorkflowIcon className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{wf.name}</span>
                <span className="block text-xs text-muted-foreground">{titleCase(wf.trigger.type)}{wf.trigger.entityKey ? ` · ${wf.trigger.entityKey}` : ''}</span>
              </span>
              <StatusBadge status={wf.status} />
            </button>
          </li>
        ))}
        {state.definition.workflows.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No automations yet. Automations react to record changes — for example, notify the team when a lead is created.
          </p>
        )}
      </ul>
    </div>
  );
}

// ── Theme panel ──────────────────────────────────────────────────
const themeColors = ['#4f46e5', '#0284c7', '#0f766e', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#334155'];

export function ThemePanel({ state }: { state: BuilderState }) {
  const theme = state.definition.theme;
  return (
    <div className="space-y-4 p-3">
      <div>
        <p className="mb-1.5 text-sm font-medium">Brand color</p>
        <div className="flex flex-wrap gap-2">
          {themeColors.map((color) => (
            <button
              key={color}
              aria-label={`Use color ${color}`}
              onClick={() => state.update((def) => { def.theme.primaryColor = color; })}
              className={cn('size-8 rounded-full border-2', theme.primaryColor === color ? 'border-foreground' : 'border-transparent')}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <FormField label="Corner radius">
        {(id) => (
          <Select id={id} value={theme.radius} onChange={(e) => state.update((def) => { def.theme.radius = e.target.value as never; })}>
            <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option>
          </Select>
        )}
      </FormField>
      <FormField label="Density">
        {(id) => (
          <Select id={id} value={theme.density} onChange={(e) => state.update((def) => { def.theme.density = e.target.value as never; })}>
            <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
          </Select>
        )}
      </FormField>
      <FormField label="Appearance">
        {(id) => (
          <Select id={id} value={theme.mode} onChange={(e) => state.update((def) => { def.theme.mode = e.target.value as never; })}>
            <option value="light">Light</option><option value="dark">Dark</option><option value="system">Match device</option>
          </Select>
        )}
      </FormField>
    </div>
  );
}

// ── App settings panel ───────────────────────────────────────────
export function AppSettingsPanel({ state }: { state: BuilderState }) {
  const app = state.definition.app;
  return (
    <div className="space-y-4 p-3">
      <FormField label="Application name">
        {(id) => <Input id={id} value={app.name} onChange={(e) => state.update((def) => { def.app.name = e.target.value; })} />}
      </FormField>
      <FormField label="Description">
        {(id) => <Input id={id} value={app.description} onChange={(e) => state.update((def) => { def.app.description = e.target.value; })} />}
      </FormField>
      <FormField label="Icon" hint="Any Lucide icon name, e.g. briefcase, users, package.">
        {(id) => <Input id={id} value={app.icon} onChange={(e) => state.update((def) => { def.app.icon = e.target.value; })} />}
      </FormField>
      <FormField label="Currency">
        {(id) => (
          <Select id={id} value={app.currency} onChange={(e) => state.update((def) => { def.app.currency = e.target.value; })}>
            <option>USD</option><option>EUR</option><option>GBP</option><option>INR</option><option>AUD</option>
          </Select>
        )}
      </FormField>
      <Switch
        label="Allow customer self-registration"
        checked={state.definition.settings.allowSelfRegistration}
        onChange={(v) => state.update((def) => { def.settings.allowSelfRegistration = v; })}
      />
      <div className="border-t pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</p>
        <ul className="space-y-1 text-sm">
          {state.definition.roles.map((role) => (
            <li key={role.id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5">
              <span>{role.name}</span>
              {role.isDefault && <Badge tone="primary">Default</Badge>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
