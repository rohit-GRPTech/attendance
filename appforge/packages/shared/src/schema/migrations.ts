import { CURRENT_SCHEMA_VERSION } from '../constants';
import type { ApplicationDefinition } from '../types/application';

type Migration = (def: Record<string, unknown>) => Record<string, unknown>;

/**
 * Schema migration registry. When CURRENT_SCHEMA_VERSION is bumped, add a
 * migration keyed by the version being upgraded FROM. Migrations run in
 * sequence so any stored definition can be brought up to date on load.
 */
const migrations: Record<number, Migration> = {
  // Example for a future v1 -> v2 migration:
  // 1: (def) => ({ ...def, schemaVersion: 2, settings: { ...def.settings, newField: defaultValue } }),
};

export function migrateDefinition(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  let def = raw as Record<string, unknown>;
  let version = typeof def.schemaVersion === 'number' ? def.schemaVersion : 1;
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) break;
    def = migrate(def);
    version = typeof def.schemaVersion === 'number' ? def.schemaVersion : version + 1;
  }
  return def;
}

export interface DefinitionDiffEntry {
  kind: 'added' | 'removed' | 'changed';
  section: 'entities' | 'pages' | 'workflows' | 'roles' | 'navigation';
  id: string;
  label: string;
}

/** Shallow structural diff between two definitions, used for version history UI. */
export function diffDefinitions(a: ApplicationDefinition, b: ApplicationDefinition): DefinitionDiffEntry[] {
  const out: DefinitionDiffEntry[] = [];
  const sections = [
    ['entities', (d: ApplicationDefinition) => d.entities.map((e) => ({ id: e.id, label: e.name, body: e }))],
    ['pages', (d: ApplicationDefinition) => d.pages.map((p) => ({ id: p.id, label: p.name, body: p }))],
    ['workflows', (d: ApplicationDefinition) => d.workflows.map((w) => ({ id: w.id, label: w.name, body: w }))],
    ['roles', (d: ApplicationDefinition) => d.roles.map((r) => ({ id: r.id, label: r.name, body: r }))],
    ['navigation', (d: ApplicationDefinition) => d.navigation.map((n) => ({ id: n.id, label: n.label, body: n }))],
  ] as const;

  for (const [section, pick] of sections) {
    const before = new Map(pick(a).map((x) => [x.id, x]));
    const after = new Map(pick(b).map((x) => [x.id, x]));
    for (const [id, item] of after) {
      const prev = before.get(id);
      if (!prev) out.push({ kind: 'added', section, id, label: item.label });
      else if (JSON.stringify(prev.body) !== JSON.stringify(item.body))
        out.push({ kind: 'changed', section, id, label: item.label });
    }
    for (const [id, item] of before) {
      if (!after.has(id)) out.push({ kind: 'removed', section, id, label: item.label });
    }
  }
  return out;
}

/** Deep-clone a definition assigning fresh ids — used for template installation. */
export function cloneDefinitionWithNewIds(
  def: ApplicationDefinition,
  makeId: () => string,
  overrides?: { name?: string; slug?: string },
): ApplicationDefinition {
  const idMap = new Map<string, string>();
  const remap = (oldId: string): string => {
    let next = idMap.get(oldId);
    if (!next) {
      next = makeId();
      idMap.set(oldId, next);
    }
    return next;
  };

  const cloned: ApplicationDefinition = JSON.parse(JSON.stringify(def));
  cloned.app.id = makeId();
  if (overrides?.name) cloned.app.name = overrides.name;
  if (overrides?.slug) cloned.app.slug = overrides.slug;

  for (const entity of cloned.entities) {
    entity.id = remap(entity.id);
    for (const field of entity.fields) field.id = remap(field.id);
  }
  const remapComponents = (nodes: ApplicationDefinition['pages'][number]['components']) => {
    for (const node of nodes) {
      node.id = remap(node.id);
      for (const action of node.actions ?? []) {
        action.id = remap(action.id);
        if (action.targetPageId) action.targetPageId = remap(action.targetPageId);
        if (action.workflowId) action.workflowId = remap(action.workflowId);
      }
      if (node.children) remapComponents(node.children);
    }
  };
  for (const page of cloned.pages) {
    page.id = remap(page.id);
    if (page.allowedRoleIds) page.allowedRoleIds = page.allowedRoleIds.map(remap);
    remapComponents(page.components);
  }
  for (const nav of cloned.navigation) {
    nav.id = remap(nav.id);
    nav.pageId = remap(nav.pageId);
  }
  for (const wf of cloned.workflows) {
    wf.id = remap(wf.id);
    for (const node of wf.nodes) node.id = remap(node.id);
    for (const edge of wf.edges) {
      edge.id = remap(edge.id);
      edge.sourceNodeId = remap(edge.sourceNodeId);
      edge.targetNodeId = remap(edge.targetNodeId);
    }
  }
  for (const role of cloned.roles) {
    role.id = remap(role.id);
    if (role.pageIds !== 'all') role.pageIds = role.pageIds.map(remap);
  }
  if (cloned.settings.defaultRoleId) cloned.settings.defaultRoleId = remap(cloned.settings.defaultRoleId);
  return cloned;
}
