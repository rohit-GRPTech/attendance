import type {
  ApplicationDefinition,
  AppRoleDef,
  ComponentNode,
  EntityDef,
  EntityFieldDef,
  NavigationItemDef,
  PageDef,
  WorkflowDef,
} from '../types/application';
import type { BusinessCategory, FieldType } from '../constants';
import { CURRENT_SCHEMA_VERSION } from '../constants';

/** Deterministic id helper for sample definitions (stable across seeds). */
export function sampleId(prefix: string, name: string): string {
  return `${prefix}_${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}

export function field(key: string, label: string, type: FieldType, extra: Partial<EntityFieldDef> = {}): EntityFieldDef {
  return { id: sampleId('fld', key + '_' + label), key, label, type, ...extra };
}

export function options(...labels: string[]): EntityFieldDef['options'] {
  return labels.map((label) => ({
    id: sampleId('opt', label),
    label,
    value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  }));
}

export function entity(
  key: string,
  name: string,
  pluralName: string,
  displayFieldKey: string,
  fields: EntityFieldDef[],
  icon = 'database',
): EntityDef {
  return {
    id: sampleId('ent', key), key, name, pluralName, icon, displayFieldKey,
    fields, timestamps: true, softDelete: true, auditTracking: true,
  };
}

export function listPage(slug: string, name: string, entityKey: string, icon: string, columns: string[]): PageDef {
  return {
    id: sampleId('pg', slug),
    name, slug, type: 'record_list', icon, showInNavigation: true, layout: 'full_width',
    dataSource: { entityKey },
    components: [
      { id: sampleId('cmp', slug + '_heading'), type: 'heading', props: { text: name, level: 1 } },
      {
        id: sampleId('cmp', slug + '_table'),
        type: 'data_table',
        props: { columns, pageSize: 10, searchable: true, allowCreate: true, allowEdit: true, allowDelete: true },
        dataSource: { entityKey },
      },
    ],
  };
}

export function dashboardPage(slug: string, name: string, stats: Array<{ label: string; entityKey: string }>, chart?: { entityKey: string; groupByFieldKey: string; title: string }): PageDef {
  const components: ComponentNode[] = [
    { id: sampleId('cmp', slug + '_heading'), type: 'heading', props: { text: name, level: 1 } },
    {
      id: sampleId('cmp', slug + '_stats'),
      type: 'columns',
      props: { columns: Math.min(stats.length, 4) },
      children: stats.map((s) => ({
        id: sampleId('cmp', slug + '_stat_' + s.entityKey),
        type: 'stat_card',
        props: { label: s.label, metric: 'count' },
        dataSource: { entityKey: s.entityKey },
      })),
    },
  ];
  if (chart) {
    components.push({
      id: sampleId('cmp', slug + '_chart'),
      type: 'bar_chart',
      props: { title: chart.title, groupByFieldKey: chart.groupByFieldKey },
      dataSource: { entityKey: chart.entityKey },
    });
  }
  return {
    id: sampleId('pg', slug), name, slug, type: 'dashboard', icon: 'layout-dashboard',
    showInNavigation: true, layout: 'single', isHome: true, components,
  };
}

export function navigationFromPages(pages: PageDef[]): NavigationItemDef[] {
  return pages
    .filter((p) => p.showInNavigation)
    .map((p, i) => ({ id: sampleId('nav', p.slug), label: p.name, icon: p.icon, pageId: p.id, order: i }));
}

export function adminRole(appKey: string, entities: EntityDef[]): AppRoleDef {
  return {
    id: sampleId('role', appKey + '_admin'), key: 'admin', name: 'Administrator',
    description: 'Full access to every page and record.',
    pageIds: 'all',
    entityPermissions: entities.map((e) => ({
      entityKey: e.key, create: true, read: true, update: true, delete: true, recordScope: 'all',
    })),
    canExport: true, canImport: true, canManageUsers: true, canManageSettings: true,
  };
}

export function memberRole(appKey: string, entities: EntityDef[]): AppRoleDef {
  return {
    id: sampleId('role', appKey + '_member'), key: 'member', name: 'Team member',
    description: 'Can work with records but cannot delete or manage settings.', isDefault: true,
    pageIds: 'all',
    entityPermissions: entities.map((e) => ({
      entityKey: e.key, create: true, read: true, update: true, delete: false, recordScope: 'all',
    })),
    canExport: true, canImport: false, canManageUsers: false, canManageSettings: false,
  };
}

export function notifyWorkflow(appKey: string, name: string, entityKey: string, message: string): WorkflowDef {
  const triggerId = sampleId('wfn', appKey + '_' + name + '_trigger');
  const actionId = sampleId('wfn', appKey + '_' + name + '_notify');
  return {
    id: sampleId('wf', appKey + '_' + name),
    name, status: 'active',
    trigger: { type: 'record_created', entityKey },
    nodes: [
      { id: triggerId, type: 'trigger', label: 'Record created', config: { entityKey }, position: { x: 80, y: 80 } },
      { id: actionId, type: 'create_notification', label: 'Notify owner', config: { message }, position: { x: 80, y: 220 } },
    ],
    edges: [{ id: sampleId('wfe', appKey + '_' + name), sourceNodeId: triggerId, targetNodeId: actionId }],
  };
}

export function baseDefinition(
  appKey: string,
  name: string,
  description: string,
  category: BusinessCategory,
  icon: string,
  entities: EntityDef[],
  pages: PageDef[],
  workflows: WorkflowDef[],
): ApplicationDefinition {
  const roles = [adminRole(appKey, entities), memberRole(appKey, entities)];
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: {
      id: sampleId('app', appKey), name, slug: appKey.replace(/_/g, '-'), description, icon, category,
      language: 'en', timezone: 'UTC', currency: 'USD', dateFormat: 'MMM d, yyyy',
    },
    entities,
    pages,
    navigation: navigationFromPages(pages),
    workflows,
    roles,
    theme: { primaryColor: '#4f46e5', radius: 'md', density: 'comfortable', mode: 'light' },
    settings: {
      allowSelfRegistration: false,
      defaultRoleId: roles[1]!.id,
      localization: { language: 'en', dateFormat: 'MMM d, yyyy', currency: 'USD' },
      featureFlags: {},
    },
  };
}
