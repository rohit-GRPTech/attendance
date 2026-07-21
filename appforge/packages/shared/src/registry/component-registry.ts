import { z } from 'zod';

/**
 * Central component registry — metadata only (framework-free). The web app
 * registers a builder preview renderer and a runtime renderer for each type.
 * Only types listed here may appear in an application definition; props are
 * validated against each component's schema. There is no escape hatch for
 * arbitrary code.
 */

export type ComponentCategory = 'layout' | 'data' | 'form' | 'content' | 'chart' | 'action';

export interface ComponentDescriptor {
  type: string;
  label: string;
  category: ComponentCategory;
  icon: string;
  description: string;
  /** Zod schema for the props object. */
  propsSchema: z.ZodType<Record<string, unknown>>;
  defaultProps: Record<string, unknown>;
  /** Whether the component accepts child components. */
  acceptsChildren: boolean;
  /** Whether the component binds to an entity field (form inputs). */
  bindsField: boolean;
  /** Whether the component reads from an entity data source. */
  usesDataSource: boolean;
  supportedActions: string[];
}

const text = (max = 500) => z.string().max(max);

const base = { acceptsChildren: false, bindsField: false, usesDataSource: false, supportedActions: [] as string[] };

function descriptor(d: Omit<ComponentDescriptor, keyof typeof base> & Partial<typeof base>): ComponentDescriptor {
  return { ...base, ...d };
}

export const componentDescriptors: ComponentDescriptor[] = [
  // ── Layout ──────────────────────────────────────────────────────
  descriptor({
    type: 'container', label: 'Container', category: 'layout', icon: 'square',
    description: 'Groups components with padding and an optional border.',
    propsSchema: z.object({ padded: z.boolean().optional(), bordered: z.boolean().optional() }).passthrough(),
    defaultProps: { padded: true, bordered: false }, acceptsChildren: true,
  }),
  descriptor({
    type: 'section', label: 'Section', category: 'layout', icon: 'layout-panel-top',
    description: 'A titled section with an optional description.',
    propsSchema: z.object({ title: text(120), description: text(300).optional() }).passthrough(),
    defaultProps: { title: 'Section title' }, acceptsChildren: true,
  }),
  descriptor({
    type: 'columns', label: 'Columns', category: 'layout', icon: 'columns-2',
    description: 'Responsive multi-column layout.',
    propsSchema: z.object({ columns: z.number().int().min(1).max(4) }).passthrough(),
    defaultProps: { columns: 2 }, acceptsChildren: true,
  }),
  descriptor({
    type: 'stack', label: 'Stack', category: 'layout', icon: 'rows-3',
    description: 'Vertical stack with consistent spacing.',
    propsSchema: z.object({ gap: z.enum(['sm', 'md', 'lg']).optional() }).passthrough(),
    defaultProps: { gap: 'md' }, acceptsChildren: true,
  }),
  descriptor({
    type: 'card', label: 'Card', category: 'layout', icon: 'credit-card',
    description: 'Elevated card surface with optional title.',
    propsSchema: z.object({ title: text(120).optional() }).passthrough(),
    defaultProps: {}, acceptsChildren: true,
  }),
  descriptor({
    type: 'divider', label: 'Divider', category: 'layout', icon: 'minus',
    description: 'A horizontal separator line.',
    propsSchema: z.object({}).passthrough(), defaultProps: {},
  }),
  descriptor({
    type: 'spacer', label: 'Spacer', category: 'layout', icon: 'move-vertical',
    description: 'Vertical whitespace.',
    propsSchema: z.object({ size: z.enum(['sm', 'md', 'lg']).optional() }).passthrough(),
    defaultProps: { size: 'md' },
  }),
  descriptor({
    type: 'tabs', label: 'Tabs', category: 'layout', icon: 'app-window',
    description: 'Tabbed container; each child renders as a tab.',
    propsSchema: z.object({ labels: z.array(text(60)).max(10) }).passthrough(),
    defaultProps: { labels: ['Tab 1', 'Tab 2'] }, acceptsChildren: true,
  }),

  // ── Data display ────────────────────────────────────────────────
  descriptor({
    type: 'data_table', label: 'Data table', category: 'data', icon: 'table',
    description: 'Sortable, paginated table bound to a data entity.',
    propsSchema: z.object({
      columns: z.array(z.string()).max(30).optional(),
      pageSize: z.number().int().min(5).max(100).optional(),
      searchable: z.boolean().optional(),
      allowCreate: z.boolean().optional(),
      allowEdit: z.boolean().optional(),
      allowDelete: z.boolean().optional(),
    }).passthrough(),
    defaultProps: { pageSize: 10, searchable: true, allowCreate: true, allowEdit: true, allowDelete: true },
    usesDataSource: true, supportedActions: ['open_create_modal', 'open_edit_modal', 'delete_record', 'export_csv'],
  }),
  descriptor({
    type: 'record_list', label: 'Record list', category: 'data', icon: 'list',
    description: 'Compact list of records with the entity display field.',
    propsSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }).passthrough(),
    defaultProps: { limit: 10 }, usesDataSource: true, supportedActions: ['navigate'],
  }),
  descriptor({
    type: 'stat_card', label: 'Statistic card', category: 'data', icon: 'trending-up',
    description: 'Single metric with label; counts records of an entity.',
    propsSchema: z.object({ label: text(80), metric: z.enum(['count']).optional() }).passthrough(),
    defaultProps: { label: 'Total records', metric: 'count' }, usesDataSource: true,
  }),
  descriptor({
    type: 'detail_view', label: 'Detail view', category: 'data', icon: 'file-text',
    description: 'Read-only field/value layout for a single record.',
    propsSchema: z.object({ fields: z.array(z.string()).max(50).optional() }).passthrough(),
    defaultProps: {}, usesDataSource: true,
  }),
  descriptor({
    type: 'kanban', label: 'Kanban board', category: 'data', icon: 'kanban',
    description: 'Cards grouped into columns by a select or status field.',
    propsSchema: z.object({ groupByFieldKey: z.string() }).passthrough(),
    defaultProps: { groupByFieldKey: 'status' }, usesDataSource: true,
  }),

  // ── Forms ───────────────────────────────────────────────────────
  descriptor({
    type: 'form', label: 'Form', category: 'form', icon: 'clipboard-list',
    description: 'Creates or edits a record of the bound entity. Fields are generated from the entity or provided as children.',
    propsSchema: z.object({
      mode: z.enum(['create', 'edit']).optional(),
      submitLabel: text(60).optional(),
      fields: z.array(z.string()).max(50).optional(),
    }).passthrough(),
    defaultProps: { mode: 'create', submitLabel: 'Save' },
    usesDataSource: true, acceptsChildren: true, supportedActions: ['submit_form', 'navigate'],
  }),
  descriptor({
    type: 'text_input', label: 'Text input', category: 'form', icon: 'type',
    description: 'Single-line text field bound to an entity field.',
    propsSchema: z.object({ label: text(120).optional(), placeholder: text(200).optional() }).passthrough(),
    defaultProps: {}, bindsField: true,
  }),
  descriptor({
    type: 'textarea', label: 'Text area', category: 'form', icon: 'text',
    description: 'Multi-line text field.',
    propsSchema: z.object({ label: text(120).optional(), rows: z.number().int().min(2).max(20).optional() }).passthrough(),
    defaultProps: { rows: 4 }, bindsField: true,
  }),
  descriptor({
    type: 'number_input', label: 'Number input', category: 'form', icon: 'hash',
    description: 'Numeric field with min/max from the entity definition.',
    propsSchema: z.object({ label: text(120).optional() }).passthrough(),
    defaultProps: {}, bindsField: true,
  }),
  descriptor({
    type: 'select_input', label: 'Select', category: 'form', icon: 'chevron-down',
    description: 'Dropdown using options from the bound field.',
    propsSchema: z.object({ label: text(120).optional() }).passthrough(),
    defaultProps: {}, bindsField: true,
  }),
  descriptor({
    type: 'checkbox_input', label: 'Checkbox', category: 'form', icon: 'check-square',
    description: 'Boolean checkbox.',
    propsSchema: z.object({ label: text(120).optional() }).passthrough(),
    defaultProps: {}, bindsField: true,
  }),
  descriptor({
    type: 'date_input', label: 'Date picker', category: 'form', icon: 'calendar',
    description: 'Date field.',
    propsSchema: z.object({ label: text(120).optional() }).passthrough(),
    defaultProps: {}, bindsField: true,
  }),
  descriptor({
    type: 'relation_input', label: 'Relationship selector', category: 'form', icon: 'link-2',
    description: 'Select a related record.',
    propsSchema: z.object({ label: text(120).optional() }).passthrough(),
    defaultProps: {}, bindsField: true,
  }),

  // ── Content ─────────────────────────────────────────────────────
  descriptor({
    type: 'heading', label: 'Heading', category: 'content', icon: 'heading-1',
    description: 'Page or section heading.',
    propsSchema: z.object({ text: text(200), level: z.number().int().min(1).max(4).optional() }).passthrough(),
    defaultProps: { text: 'Heading', level: 2 },
  }),
  descriptor({
    type: 'paragraph', label: 'Paragraph', category: 'content', icon: 'pilcrow',
    description: 'Body text.',
    propsSchema: z.object({ text: text(5000) }).passthrough(),
    defaultProps: { text: 'Write something helpful for your users here.' },
  }),
  descriptor({
    type: 'alert', label: 'Alert', category: 'content', icon: 'alert-circle',
    description: 'Callout for important information.',
    propsSchema: z.object({ title: text(120).optional(), text: text(1000), tone: z.enum(['info', 'success', 'warning', 'danger']).optional() }).passthrough(),
    defaultProps: { text: 'Something your users should know.', tone: 'info' },
  }),
  descriptor({
    type: 'image', label: 'Image', category: 'content', icon: 'image',
    description: 'Image from an uploaded file or URL.',
    propsSchema: z.object({ src: text(2000).optional(), alt: text(200).optional() }).passthrough(),
    defaultProps: { alt: 'Image' },
  }),

  // ── Charts ──────────────────────────────────────────────────────
  descriptor({
    type: 'bar_chart', label: 'Bar chart', category: 'chart', icon: 'bar-chart-3',
    description: 'Record counts grouped by a field.',
    propsSchema: z.object({ title: text(120).optional(), groupByFieldKey: z.string() }).passthrough(),
    defaultProps: { groupByFieldKey: 'status' }, usesDataSource: true,
  }),
  descriptor({
    type: 'pie_chart', label: 'Pie chart', category: 'chart', icon: 'pie-chart',
    description: 'Share of records grouped by a field.',
    propsSchema: z.object({ title: text(120).optional(), groupByFieldKey: z.string() }).passthrough(),
    defaultProps: { groupByFieldKey: 'status' }, usesDataSource: true,
  }),
  descriptor({
    type: 'line_chart', label: 'Line chart', category: 'chart', icon: 'line-chart',
    description: 'Records created over time.',
    propsSchema: z.object({ title: text(120).optional() }).passthrough(),
    defaultProps: {}, usesDataSource: true,
  }),

  // ── Actions ─────────────────────────────────────────────────────
  descriptor({
    type: 'button', label: 'Button', category: 'action', icon: 'mouse-pointer-click',
    description: 'Triggers a configured action — navigation, record creation or a workflow.',
    propsSchema: z.object({ label: text(80), variant: z.enum(['primary', 'secondary', 'outline', 'danger']).optional() }).passthrough(),
    defaultProps: { label: 'Button', variant: 'primary' },
    supportedActions: ['navigate', 'open_create_modal', 'run_workflow', 'export_csv'],
  }),
];

const registryIndex = new Map(componentDescriptors.map((d) => [d.type, d]));

export function getComponentDescriptor(type: string): ComponentDescriptor | undefined {
  return registryIndex.get(type);
}

export function isRegisteredComponentType(type: string): boolean {
  return registryIndex.has(type);
}

export function componentsByCategory(): Record<ComponentCategory, ComponentDescriptor[]> {
  const out: Record<ComponentCategory, ComponentDescriptor[]> = {
    layout: [], data: [], form: [], content: [], chart: [], action: [],
  };
  for (const d of componentDescriptors) out[d.category].push(d);
  return out;
}
