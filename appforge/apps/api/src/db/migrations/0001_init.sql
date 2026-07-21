-- AppForge initial schema (PostgreSQL 14+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  password_hash text NOT NULL,
  full_name varchar(200) NOT NULL,
  platform_role varchar(32) NOT NULL DEFAULT 'member',
  email_verified_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  slug varchar(64) NOT NULL,
  plan_id varchar(32) NOT NULL DEFAULT 'free',
  suspended_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_tenant_user_idx ON memberships (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email varchar(255) NOT NULL,
  role varchar(32) NOT NULL,
  token varchar(64) NOT NULL,
  invited_by_user_id uuid NOT NULL REFERENCES users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx ON invitations (token);
CREATE INDEX IF NOT EXISTS invitations_tenant_idx ON invitations (tenant_id);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(200) NOT NULL,
  slug varchar(64) NOT NULL,
  description text NOT NULL DEFAULT '',
  icon varchar(64) NOT NULL DEFAULT 'layout-grid',
  category varchar(48) NOT NULL DEFAULT 'custom',
  status varchar(24) NOT NULL DEFAULT 'draft',
  draft_definition jsonb NOT NULL,
  published_version_id uuid,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS applications_tenant_idx ON applications (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS applications_tenant_slug_idx ON applications (tenant_id, slug);

CREATE TABLE IF NOT EXISTS application_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  application_id uuid NOT NULL REFERENCES applications(id),
  version integer NOT NULL,
  definition jsonb NOT NULL,
  published_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS application_versions_app_idx ON application_versions (tenant_id, application_id);
CREATE UNIQUE INDEX IF NOT EXISTS application_versions_app_version_idx ON application_versions (application_id, version);

CREATE TABLE IF NOT EXISTS records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  application_id uuid NOT NULL REFERENCES applications(id),
  entity_key varchar(64) NOT NULL,
  data jsonb NOT NULL,
  created_by_user_id uuid NOT NULL,
  updated_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS records_lookup_idx ON records (tenant_id, application_id, entity_key);
CREATE INDEX IF NOT EXISTS records_data_idx ON records USING gin (data);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  application_id uuid NOT NULL,
  workflow_id varchar(64) NOT NULL,
  workflow_name varchar(200) NOT NULL,
  trigger_type varchar(48) NOT NULL,
  status varchar(16) NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]',
  error text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS workflow_runs_tenant_idx ON workflow_runs (tenant_id, application_id);

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_tenant_id uuid NOT NULL REFERENCES tenants(id),
  creator_user_id uuid NOT NULL REFERENCES users(id),
  creator_name varchar(200) NOT NULL,
  name varchar(200) NOT NULL,
  slug varchar(64) NOT NULL,
  short_description varchar(300) NOT NULL,
  long_description text NOT NULL DEFAULT '',
  category varchar(48) NOT NULL,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  status varchar(24) NOT NULL DEFAULT 'draft',
  featured boolean NOT NULL DEFAULT false,
  install_count integer NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  definition jsonb NOT NULL,
  screenshots jsonb NOT NULL DEFAULT '[]',
  version varchar(24) NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS templates_slug_idx ON templates (slug);

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  template_id uuid NOT NULL REFERENCES templates(id),
  template_name varchar(200) NOT NULL,
  purchased_by_user_id uuid NOT NULL,
  price_paid_usd numeric(10,2) NOT NULL DEFAULT 0,
  installed_application_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchases_tenant_idx ON purchases (tenant_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL,
  kind varchar(32) NOT NULL,
  title varchar(200) NOT NULL,
  body text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  application_id uuid,
  user_id uuid,
  action varchar(64) NOT NULL,
  resource_type varchar(64) NOT NULL,
  resource_id varchar(64),
  summary text NOT NULL,
  ip_address varchar(64),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON audit_logs (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL,
  application_id uuid,
  provider varchar(48) NOT NULL,
  model varchar(96) NOT NULL,
  prompt_version varchar(24) NOT NULL,
  status varchar(32) NOT NULL,
  validation_errors jsonb NOT NULL DEFAULT '[]',
  token_usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_generations_tenant_idx ON ai_generations (tenant_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  plan_id varchar(32) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active',
  renews_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_idx ON subscriptions (tenant_id);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  application_id uuid,
  file_name varchar(255) NOT NULL,
  mime_type varchar(128) NOT NULL,
  size_bytes integer NOT NULL,
  storage_key varchar(255) NOT NULL,
  uploaded_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_tenant_idx ON files (tenant_id);

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(64) NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_idx ON feature_flags (key);
