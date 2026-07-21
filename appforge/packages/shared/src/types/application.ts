import type {
  BusinessCategory,
  FieldType,
  FilterOperator,
  PageType,
  RecordScope,
  RelationKind,
  WorkflowNodeType,
  WorkflowTriggerType,
} from '../constants';

/**
 * Versioned JSON application definition. This is the single contract shared
 * by the builder (which edits it) and the runtime engine (which renders it).
 * Every major object carries a stable unique id — never an array index.
 */

export interface AppMeta {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: BusinessCategory;
  language: string;
  timezone: string;
  currency: string;
  dateFormat: string;
}

export interface FieldOption {
  id: string;
  label: string;
  value: string;
  color?: string;
}

export interface EntityFieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  placeholder?: string;
  required?: boolean;
  unique?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  defaultValue?: string | number | boolean | null;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: FieldOption[];
  /** For relation/user fields */
  relation?: {
    kind: RelationKind;
    targetEntityKey: string;
    displayFieldKey?: string;
  };
}

export interface EntityDef {
  id: string;
  key: string;
  name: string;
  pluralName: string;
  icon?: string;
  description?: string;
  displayFieldKey: string;
  fields: EntityFieldDef[];
  softDelete?: boolean;
  timestamps?: boolean;
  auditTracking?: boolean;
}

export interface FilterCondition {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value?: string | number | boolean | Array<string | number> | null;
}

export interface DataSourceDef {
  entityKey: string;
  filters?: FilterCondition[];
  sort?: { fieldKey: string; direction: 'asc' | 'desc' };
  limit?: number;
}

/** A visibility rule evaluated by the runtime — declarative only, never code. */
export interface VisibilityRule {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value?: string | number | boolean | null;
}

export type ComponentActionType =
  | 'navigate'
  | 'open_create_modal'
  | 'open_edit_modal'
  | 'delete_record'
  | 'run_workflow'
  | 'export_csv'
  | 'submit_form';

export interface ComponentAction {
  id: string;
  type: ComponentActionType;
  label?: string;
  targetPageId?: string;
  workflowId?: string;
  entityKey?: string;
}

/**
 * A component instance placed on a page. `type` must exist in the component
 * registry; `props` are validated against that component's prop schema.
 * Children compose layout components. No executable content is permitted.
 */
export interface ComponentNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  dataSource?: DataSourceDef;
  /** Field binding for form inputs */
  fieldKey?: string;
  visibility?: VisibilityRule[];
  actions?: ComponentAction[];
  children?: ComponentNode[];
}

export interface PageDef {
  id: string;
  name: string;
  slug: string;
  type: PageType;
  icon?: string;
  showInNavigation: boolean;
  allowedRoleIds?: string[];
  layout: 'single' | 'two_column' | 'full_width';
  components: ComponentNode[];
  dataSource?: DataSourceDef;
  isHome?: boolean;
  seo?: { title?: string; description?: string };
}

export interface NavigationItemDef {
  id: string;
  label: string;
  icon?: string;
  pageId: string;
  order: number;
}

export interface WorkflowNodeDef {
  id: string;
  type: WorkflowNodeType;
  label?: string;
  /** Declarative configuration for the node (validated per node type). */
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdgeDef {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  /** Branch label for condition nodes, e.g. "true" / "false". */
  branch?: string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'disabled';
  trigger: {
    type: WorkflowTriggerType;
    entityKey?: string;
    schedule?: string;
  };
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
}

export interface EntityPermissionDef {
  entityKey: string;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  recordScope: RecordScope;
  scopeFilter?: FilterCondition[];
  fieldOverrides?: Array<{ fieldKey: string; access: 'visible' | 'editable' | 'hidden' }>;
}

export interface AppRoleDef {
  id: string;
  key: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  pageIds: string[] | 'all';
  entityPermissions: EntityPermissionDef[];
  canExport: boolean;
  canImport: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export interface ThemeDef {
  primaryColor: string;
  radius: 'sm' | 'md' | 'lg';
  density: 'comfortable' | 'compact';
  mode: 'light' | 'dark' | 'system';
}

export interface AppSettingsDef {
  allowSelfRegistration: boolean;
  defaultRoleId?: string;
  localization: { language: string; dateFormat: string; currency: string };
  featureFlags: Record<string, boolean>;
}

export interface ApplicationDefinition {
  schemaVersion: number;
  app: AppMeta;
  entities: EntityDef[];
  pages: PageDef[];
  navigation: NavigationItemDef[];
  workflows: WorkflowDef[];
  roles: AppRoleDef[];
  theme: ThemeDef;
  settings: AppSettingsDef;
}

/** Result of validating a definition — shared by builder, publisher and AI repair. */
export interface DefinitionIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}
