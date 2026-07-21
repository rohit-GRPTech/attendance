import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * PostgreSQL platform schema (Drizzle). Every tenant-owned table carries
 * tenant_id with an index; dynamic application records live in `records`
 * using JSONB. See src/db/migrations/0001_init.sql for the executable DDL.
 */

const id = () => uuid('id').primaryKey();
const tenantId = () => uuid('tenant_id').notNull();
const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  platformRole: varchar('platform_role', { length: 32 }).notNull().default('member'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'string' }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true, mode: 'string' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({ emailIdx: uniqueIndex('users_email_idx').on(t.email) }));

export const tenants = pgTable('tenants', {
  id: id(),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  planId: varchar('plan_id', { length: 32 }).notNull().default('free'),
  suspendedAt: timestamp('suspended_at', { withTimezone: true, mode: 'string' }),
  settings: jsonb('settings').notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({ slugIdx: uniqueIndex('tenants_slug_idx').on(t.slug) }));

export const memberships = pgTable('memberships', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: varchar('role', { length: 32 }).notNull(),
  createdAt: createdAt(),
}, (t) => ({
  uniq: uniqueIndex('memberships_tenant_user_idx').on(t.tenantId, t.userId),
  userIdx: index('memberships_user_idx').on(t.userId),
}));

export const invitations = pgTable('invitations', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull(),
  token: varchar('token', { length: 64 }).notNull(),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: createdAt(),
}, (t) => ({
  tokenIdx: uniqueIndex('invitations_token_idx').on(t.token),
  tenantIdx: index('invitations_tenant_idx').on(t.tenantId),
}));

export const applications = pgTable('applications', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  description: text('description').notNull().default(''),
  icon: varchar('icon', { length: 64 }).notNull().default('layout-grid'),
  category: varchar('category', { length: 48 }).notNull().default('custom'),
  status: varchar('status', { length: 24 }).notNull().default('draft'),
  draftDefinition: jsonb('draft_definition').notNull(),
  publishedVersionId: uuid('published_version_id'),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
}, (t) => ({
  tenantIdx: index('applications_tenant_idx').on(t.tenantId),
  slugIdx: uniqueIndex('applications_tenant_slug_idx').on(t.tenantId, t.slug),
}));

export const applicationVersions = pgTable('application_versions', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  version: integer('version').notNull(),
  definition: jsonb('definition').notNull(),
  publishedByUserId: uuid('published_by_user_id').notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => ({
  appIdx: index('application_versions_app_idx').on(t.tenantId, t.applicationId),
  uniq: uniqueIndex('application_versions_app_version_idx').on(t.applicationId, t.version),
}));

export const records = pgTable('records', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  entityKey: varchar('entity_key', { length: 64 }).notNull(),
  data: jsonb('data').notNull(),
  createdByUserId: uuid('created_by_user_id').notNull(),
  updatedByUserId: uuid('updated_by_user_id').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
}, (t) => ({
  lookupIdx: index('records_lookup_idx').on(t.tenantId, t.applicationId, t.entityKey),
  dataIdx: index('records_data_idx').using('gin', t.data),
}));

export const workflowRuns = pgTable('workflow_runs', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  applicationId: uuid('application_id').notNull(),
  workflowId: varchar('workflow_id', { length: 64 }).notNull(),
  workflowName: varchar('workflow_name', { length: 200 }).notNull(),
  triggerType: varchar('trigger_type', { length: 48 }).notNull(),
  status: varchar('status', { length: 16 }).notNull(),
  steps: jsonb('steps').notNull().default([]),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }).notNull(),
}, (t) => ({ tenantIdx: index('workflow_runs_tenant_idx').on(t.tenantId, t.applicationId) }));

export const templates = pgTable('templates', {
  id: id(),
  creatorTenantId: uuid('creator_tenant_id').notNull().references(() => tenants.id),
  creatorUserId: uuid('creator_user_id').notNull().references(() => users.id),
  creatorName: varchar('creator_name', { length: 200 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  shortDescription: varchar('short_description', { length: 300 }).notNull(),
  longDescription: text('long_description').notNull().default(''),
  category: varchar('category', { length: 48 }).notNull(),
  priceUsd: numeric('price_usd', { precision: 10, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 24 }).notNull().default('draft'),
  featured: boolean('featured').notNull().default(false),
  installCount: integer('install_count').notNull().default(0),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('0'),
  reviewCount: integer('review_count').notNull().default(0),
  definition: jsonb('definition').notNull(),
  screenshots: jsonb('screenshots').notNull().default([]),
  version: varchar('version', { length: 24 }).notNull().default('1.0.0'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({ slugIdx: uniqueIndex('templates_slug_idx').on(t.slug) }));

export const purchases = pgTable('purchases', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  templateId: uuid('template_id').notNull().references(() => templates.id),
  templateName: varchar('template_name', { length: 200 }).notNull(),
  purchasedByUserId: uuid('purchased_by_user_id').notNull(),
  pricePaidUsd: numeric('price_paid_usd', { precision: 10, scale: 2 }).notNull().default('0'),
  installedApplicationId: uuid('installed_application_id'),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index('purchases_tenant_idx').on(t.tenantId) }));

export const notifications = pgTable('notifications', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  kind: varchar('kind', { length: 32 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull().default(''),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
  createdAt: createdAt(),
}, (t) => ({ userIdx: index('notifications_user_idx').on(t.tenantId, t.userId) }));

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  applicationId: uuid('application_id'),
  userId: uuid('user_id'),
  action: varchar('action', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 64 }).notNull(),
  resourceId: varchar('resource_id', { length: 64 }),
  summary: text('summary').notNull(),
  ipAddress: varchar('ip_address', { length: 64 }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index('audit_logs_tenant_idx').on(t.tenantId, t.createdAt) }));

export const aiGenerations = pgTable('ai_generations', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  applicationId: uuid('application_id'),
  provider: varchar('provider', { length: 48 }).notNull(),
  model: varchar('model', { length: 96 }).notNull(),
  promptVersion: varchar('prompt_version', { length: 24 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  validationErrors: jsonb('validation_errors').notNull().default([]),
  tokenUsage: jsonb('token_usage'),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index('ai_generations_tenant_idx').on(t.tenantId) }));

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  planId: varchar('plan_id', { length: 32 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('active'),
  renewsAt: timestamp('renews_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: uniqueIndex('subscriptions_tenant_idx').on(t.tenantId) }));

export const files = pgTable('files', {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  applicationId: uuid('application_id'),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storageKey: varchar('storage_key', { length: 255 }).notNull(),
  uploadedByUserId: uuid('uploaded_by_user_id').notNull(),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index('files_tenant_idx').on(t.tenantId) }));

export const featureFlags = pgTable('feature_flags', {
  id: id(),
  key: varchar('key', { length: 64 }).notNull(),
  enabled: boolean('enabled').notNull().default(false),
  description: text('description').notNull().default(''),
  createdAt: createdAt(),
}, (t) => ({ keyIdx: uniqueIndex('feature_flags_key_idx').on(t.key) }));
