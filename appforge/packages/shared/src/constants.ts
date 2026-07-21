/** Central constants shared by web, API and packages. Do not duplicate these. */

export const APPLICATION_STATUSES = ['draft', 'testing', 'published', 'archived', 'suspended'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PLATFORM_ROLES = [
  'platform_owner',
  'platform_admin',
  'template_creator',
  'member',
] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const TENANT_ROLES = [
  'tenant_owner',
  'tenant_admin',
  'app_manager',
  'app_user',
  'read_only',
] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const BUSINESS_CATEGORIES = [
  'crm',
  'sales',
  'inventory',
  'orders',
  'appointments',
  'service_management',
  'property_management',
  'human_resources',
  'education',
  'healthcare_administration',
  'project_management',
  'customer_support',
  'finance',
  'operations',
  'custom',
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export const FIELD_TYPES = [
  'short_text',
  'long_text',
  'rich_text',
  'number',
  'decimal',
  'currency',
  'percentage',
  'boolean',
  'date',
  'datetime',
  'time',
  'email',
  'phone',
  'url',
  'select',
  'multi_select',
  'file',
  'image',
  'user',
  'relation',
  'formula',
  'auto_number',
  'uuid',
  'status',
  'address',
  'json',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const RELATION_KINDS = ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const PAGE_TYPES = [
  'dashboard',
  'record_list',
  'record_details',
  'record_create',
  'record_edit',
  'kanban',
  'calendar',
  'custom',
  'login',
  'public_form',
  'portal',
  'settings',
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const FILTER_OPERATORS = [
  'eq',
  'neq',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'gt',
  'lt',
  'gte',
  'lte',
  'is_empty',
  'is_not_empty',
  'in',
  'not_in',
  'before',
  'after',
  'between',
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const WORKFLOW_TRIGGERS = [
  'record_created',
  'record_updated',
  'record_deleted',
  'form_submitted',
  'button_clicked',
  'schedule',
  'webhook_received',
  'user_invited',
  'application_installed',
] as const;
export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGERS)[number];

export const WORKFLOW_NODE_TYPES = [
  'trigger',
  'if_else',
  'and_group',
  'or_group',
  'compare_field',
  'record_exists',
  'user_has_role',
  'date_condition',
  'create_record',
  'update_record',
  'delete_record',
  'send_email',
  'create_notification',
  'send_webhook',
  'assign_user',
  'change_status',
  'add_audit_entry',
  'delay',
  'approval_request',
] as const;
export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const WORKFLOW_MAX_NODES = 50;

export const RECORD_SCOPES = ['all', 'own', 'team', 'assigned', 'filtered', 'none'] as const;
export type RecordScope = (typeof RECORD_SCOPES)[number];

export const PLAN_IDS = ['free', 'starter', 'business', 'agency', 'enterprise'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  applications: number;
  users: number;
  records: number;
  fileStorageMb: number;
  workflowRunsPerMonth: number;
  aiGenerationsPerMonth: number;
  marketplacePublishing: boolean;
  customDomain: boolean;
  auditHistoryDays: number;
}

export const PLANS: Record<PlanId, { name: string; priceMonthlyUsd: number; limits: PlanLimits }> = {
  free: {
    name: 'Free',
    priceMonthlyUsd: 0,
    limits: {
      applications: 1, users: 3, records: 1000, fileStorageMb: 100,
      workflowRunsPerMonth: 200, aiGenerationsPerMonth: 5,
      marketplacePublishing: false, customDomain: false, auditHistoryDays: 7,
    },
  },
  starter: {
    name: 'Starter',
    priceMonthlyUsd: 29,
    limits: {
      applications: 3, users: 10, records: 25000, fileStorageMb: 2048,
      workflowRunsPerMonth: 5000, aiGenerationsPerMonth: 50,
      marketplacePublishing: false, customDomain: false, auditHistoryDays: 30,
    },
  },
  business: {
    name: 'Business',
    priceMonthlyUsd: 79,
    limits: {
      applications: 10, users: 50, records: 250000, fileStorageMb: 10240,
      workflowRunsPerMonth: 50000, aiGenerationsPerMonth: 250,
      marketplacePublishing: true, customDomain: true, auditHistoryDays: 90,
    },
  },
  agency: {
    name: 'Agency',
    priceMonthlyUsd: 199,
    limits: {
      applications: 50, users: 200, records: 1000000, fileStorageMb: 51200,
      workflowRunsPerMonth: 250000, aiGenerationsPerMonth: 1000,
      marketplacePublishing: true, customDomain: true, auditHistoryDays: 365,
    },
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthlyUsd: 499,
    limits: {
      applications: -1, users: -1, records: -1, fileStorageMb: -1,
      workflowRunsPerMonth: -1, aiGenerationsPerMonth: -1,
      marketplacePublishing: true, customDomain: true, auditHistoryDays: 730,
    },
  },
};

export const AUDIT_ACTIONS = [
  'user.login',
  'user.logout',
  'user.invited',
  'application.created',
  'application.updated',
  'application.published',
  'application.archived',
  'application.deleted',
  'entity.created',
  'entity.updated',
  'entity.deleted',
  'record.created',
  'record.updated',
  'record.deleted',
  'workflow.executed',
  'role.changed',
  'template.installed',
  'template.purchased',
  'settings.changed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const NOTIFICATION_KINDS = ['system', 'application', 'workflow', 'marketplace', 'billing', 'invitation'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const CURRENT_SCHEMA_VERSION = 1;
