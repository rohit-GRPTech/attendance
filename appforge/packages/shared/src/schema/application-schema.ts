import { z } from 'zod';
import {
  BUSINESS_CATEGORIES,
  CURRENT_SCHEMA_VERSION,
  FIELD_TYPES,
  FILTER_OPERATORS,
  PAGE_TYPES,
  RECORD_SCOPES,
  RELATION_KINDS,
  WORKFLOW_MAX_NODES,
  WORKFLOW_NODE_TYPES,
  WORKFLOW_TRIGGERS,
} from '../constants';
import type { ApplicationDefinition, DefinitionIssue } from '../types/application';

const idSchema = z.string().min(1).max(64);
const keySchema = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, 'must be snake_case starting with a letter');
const slugSchema = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/, 'must be a lowercase slug');

const fieldOptionSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(120),
  value: z.string().max(120),
  color: z.string().max(32).optional(),
});

const filterConditionSchema = z.object({
  id: idSchema,
  fieldKey: z.string().min(1),
  operator: z.enum(FILTER_OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()])), z.null()]).optional(),
});

const dataSourceSchema = z.object({
  entityKey: keySchema,
  filters: z.array(filterConditionSchema).max(20).optional(),
  sort: z.object({ fieldKey: z.string(), direction: z.enum(['asc', 'desc']) }).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

const entityFieldSchema = z.object({
  id: idSchema,
  key: keySchema,
  label: z.string().min(1).max(120),
  type: z.enum(FIELD_TYPES),
  description: z.string().max(500).optional(),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  hidden: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  pattern: z.string().max(500).optional(),
  options: z.array(fieldOptionSchema).max(100).optional(),
  relation: z
    .object({
      kind: z.enum(RELATION_KINDS),
      targetEntityKey: keySchema,
      displayFieldKey: z.string().optional(),
    })
    .optional(),
});

const entitySchema = z.object({
  id: idSchema,
  key: keySchema,
  name: z.string().min(1).max(120),
  pluralName: z.string().min(1).max(120),
  icon: z.string().max(64).optional(),
  description: z.string().max(500).optional(),
  displayFieldKey: z.string().min(1),
  fields: z.array(entityFieldSchema).min(1).max(100),
  softDelete: z.boolean().optional(),
  timestamps: z.boolean().optional(),
  auditTracking: z.boolean().optional(),
});

const visibilityRuleSchema = z.object({
  id: idSchema,
  fieldKey: z.string().min(1),
  operator: z.enum(FILTER_OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const componentActionSchema = z.object({
  id: idSchema,
  type: z.enum([
    'navigate',
    'open_create_modal',
    'open_edit_modal',
    'delete_record',
    'run_workflow',
    'export_csv',
    'submit_form',
  ]),
  label: z.string().max(120).optional(),
  targetPageId: idSchema.optional(),
  workflowId: idSchema.optional(),
  entityKey: keySchema.optional(),
});

/**
 * Component props are constrained to JSON scalars/arrays/objects — no
 * functions, no code strings are interpreted. Depth is limited by recursion.
 */
const propValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(5000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(propValueSchema).max(100),
    z.record(propValueSchema),
  ]),
);

export const componentNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: idSchema,
    type: z.string().min(1).max(64),
    props: z.record(propValueSchema),
    dataSource: dataSourceSchema.optional(),
    fieldKey: z.string().optional(),
    visibility: z.array(visibilityRuleSchema).max(10).optional(),
    actions: z.array(componentActionSchema).max(10).optional(),
    children: z.array(componentNodeSchema).max(50).optional(),
  }),
);

const pageSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  slug: slugSchema,
  type: z.enum(PAGE_TYPES),
  icon: z.string().max(64).optional(),
  showInNavigation: z.boolean(),
  allowedRoleIds: z.array(idSchema).optional(),
  layout: z.enum(['single', 'two_column', 'full_width']),
  components: z.array(componentNodeSchema).max(100),
  dataSource: dataSourceSchema.optional(),
  isHome: z.boolean().optional(),
  seo: z.object({ title: z.string().max(120).optional(), description: z.string().max(300).optional() }).optional(),
});

const navigationItemSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(80),
  icon: z.string().max(64).optional(),
  pageId: idSchema,
  order: z.number().int().min(0),
});

const workflowNodeSchema = z.object({
  id: idSchema,
  type: z.enum(WORKFLOW_NODE_TYPES),
  label: z.string().max(120).optional(),
  config: z.record(propValueSchema),
  position: z.object({ x: z.number(), y: z.number() }),
});

const workflowEdgeSchema = z.object({
  id: idSchema,
  sourceNodeId: idSchema,
  targetNodeId: idSchema,
  branch: z.string().max(32).optional(),
});

const workflowSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'disabled']),
  trigger: z.object({
    type: z.enum(WORKFLOW_TRIGGERS),
    entityKey: keySchema.optional(),
    schedule: z.string().max(64).optional(),
  }),
  nodes: z.array(workflowNodeSchema).max(WORKFLOW_MAX_NODES),
  edges: z.array(workflowEdgeSchema).max(WORKFLOW_MAX_NODES * 2),
});

const entityPermissionSchema = z.object({
  entityKey: keySchema,
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
  recordScope: z.enum(RECORD_SCOPES),
  scopeFilter: z.array(filterConditionSchema).max(10).optional(),
  fieldOverrides: z
    .array(z.object({ fieldKey: z.string(), access: z.enum(['visible', 'editable', 'hidden']) }))
    .max(100)
    .optional(),
});

const appRoleSchema = z.object({
  id: idSchema,
  key: keySchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  pageIds: z.union([z.array(idSchema), z.literal('all')]),
  entityPermissions: z.array(entityPermissionSchema),
  canExport: z.boolean(),
  canImport: z.boolean(),
  canManageUsers: z.boolean(),
  canManageSettings: z.boolean(),
});

const themeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  radius: z.enum(['sm', 'md', 'lg']),
  density: z.enum(['comfortable', 'compact']),
  mode: z.enum(['light', 'dark', 'system']),
});

const appSettingsSchema = z.object({
  allowSelfRegistration: z.boolean(),
  defaultRoleId: idSchema.optional(),
  localization: z.object({
    language: z.string().max(16),
    dateFormat: z.string().max(32),
    currency: z.string().max(8),
  }),
  featureFlags: z.record(z.boolean()),
});

const appMetaSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  slug: slugSchema,
  description: z.string().max(1000),
  icon: z.string().max(64),
  category: z.enum(BUSINESS_CATEGORIES),
  language: z.string().max(16),
  timezone: z.string().max(64),
  currency: z.string().max(8),
  dateFormat: z.string().max(32),
});

export const applicationDefinitionSchema = z.object({
  schemaVersion: z.number().int().min(1).max(CURRENT_SCHEMA_VERSION),
  app: appMetaSchema,
  entities: z.array(entitySchema).max(100),
  pages: z.array(pageSchema).max(200),
  navigation: z.array(navigationItemSchema).max(100),
  workflows: z.array(workflowSchema).max(100),
  roles: z.array(appRoleSchema).max(50),
  theme: themeSchema,
  settings: appSettingsSchema,
});

/**
 * Structural validation (zod) plus referential integrity checks: navigation
 * points at real pages, data sources point at real entities, workflow edges
 * point at real nodes and contain no cycles.
 */
export function validateApplicationDefinition(input: unknown): {
  definition: ApplicationDefinition | null;
  issues: DefinitionIssue[];
} {
  const issues: DefinitionIssue[] = [];
  const parsed = applicationDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    for (const err of parsed.error.errors) {
      issues.push({ path: err.path.join('.'), message: err.message, severity: 'error' });
    }
    return { definition: null, issues };
  }
  const def = parsed.data as unknown as ApplicationDefinition;

  const entityKeys = new Set(def.entities.map((e) => e.key));
  const pageIds = new Set(def.pages.map((p) => p.id));
  const roleIds = new Set(def.roles.map((r) => r.id));

  for (const entity of def.entities) {
    if (!entity.fields.some((f) => f.key === entity.displayFieldKey)) {
      issues.push({
        path: `entities.${entity.key}.displayFieldKey`,
        message: `Display field "${entity.displayFieldKey}" does not exist on entity "${entity.key}"`,
        severity: 'error',
      });
    }
    for (const field of entity.fields) {
      if (field.relation && !entityKeys.has(field.relation.targetEntityKey)) {
        issues.push({
          path: `entities.${entity.key}.fields.${field.key}.relation`,
          message: `Relation target entity "${field.relation.targetEntityKey}" does not exist`,
          severity: 'error',
        });
      }
    }
  }

  for (const nav of def.navigation) {
    if (!pageIds.has(nav.pageId)) {
      issues.push({
        path: `navigation.${nav.id}`,
        message: `Navigation item "${nav.label}" points to a missing page`,
        severity: 'error',
      });
    }
  }

  const checkDataSource = (path: string, entityKey?: string) => {
    if (entityKey && !entityKeys.has(entityKey)) {
      issues.push({ path, message: `Data source references missing entity "${entityKey}"`, severity: 'error' });
    }
  };

  const walkComponents = (pagePath: string, nodes: ApplicationDefinition['pages'][number]['components']) => {
    for (const node of nodes) {
      if (node.dataSource) checkDataSource(`${pagePath}.components.${node.id}.dataSource`, node.dataSource.entityKey);
      if (node.children) walkComponents(pagePath, node.children);
    }
  };

  for (const page of def.pages) {
    if (page.dataSource) checkDataSource(`pages.${page.slug}.dataSource`, page.dataSource.entityKey);
    walkComponents(`pages.${page.slug}`, page.components);
    for (const roleId of page.allowedRoleIds ?? []) {
      if (!roleIds.has(roleId)) {
        issues.push({ path: `pages.${page.slug}.allowedRoleIds`, message: 'References a missing role', severity: 'warning' });
      }
    }
  }

  for (const wf of def.workflows) {
    const nodeIds = new Set(wf.nodes.map((n) => n.id));
    for (const edge of wf.edges) {
      if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
        issues.push({ path: `workflows.${wf.id}.edges.${edge.id}`, message: 'Edge references a missing node', severity: 'error' });
      }
    }
    if (hasCycle(wf.nodes.map((n) => n.id), wf.edges)) {
      issues.push({ path: `workflows.${wf.id}`, message: `Workflow "${wf.name}" contains a circular flow`, severity: 'error' });
    }
    if (wf.trigger.entityKey && !entityKeys.has(wf.trigger.entityKey)) {
      issues.push({ path: `workflows.${wf.id}.trigger`, message: `Trigger references missing entity "${wf.trigger.entityKey}"`, severity: 'error' });
    }
  }

  if (def.pages.length > 0 && !def.pages.some((p) => p.isHome)) {
    issues.push({ path: 'pages', message: 'No page is marked as home', severity: 'warning' });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { definition: hasErrors ? null : def, issues };
}

function hasCycle(nodeIds: string[], edges: Array<{ sourceNodeId: string; targetNodeId: string }>): boolean {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) adj.get(e.sourceNodeId)?.push(e.targetNodeId);
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    const s = state.get(id);
    if (s === 'visiting') return true;
    if (s === 'done') return false;
    state.set(id, 'visiting');
    for (const next of adj.get(id) ?? []) if (visit(next)) return true;
    state.set(id, 'done');
    return false;
  };
  return nodeIds.some((id) => visit(id));
}
