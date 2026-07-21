import type { PlatformRole, TenantRole } from '../constants';
import type { ApplicationDefinition, AppRoleDef, EntityPermissionDef } from '../types/application';

/**
 * Central permission definitions and a pure evaluation service shared by the
 * web app (UX only) and the API (final authority). Keep this module free of
 * IO so both sides evaluate identically.
 */

export const TENANT_CAPABILITIES = [
  'workspace.manage',
  'members.invite',
  'members.manage',
  'roles.manage',
  'billing.manage',
  'applications.create',
  'applications.publish',
  'applications.delete',
  'applications.build',
  'data.import',
  'data.export',
  'marketplace.install',
  'audit.view',
  'settings.manage',
] as const;
export type TenantCapability = (typeof TENANT_CAPABILITIES)[number];

const TENANT_ROLE_CAPABILITIES: Record<TenantRole, TenantCapability[] | 'all'> = {
  tenant_owner: 'all',
  tenant_admin: [
    'workspace.manage', 'members.invite', 'members.manage', 'roles.manage',
    'applications.create', 'applications.publish', 'applications.delete', 'applications.build',
    'data.import', 'data.export', 'marketplace.install', 'audit.view', 'settings.manage',
  ],
  app_manager: ['applications.create', 'applications.build', 'applications.publish', 'data.import', 'data.export'],
  app_user: ['data.export'],
  read_only: [],
};

export function tenantRoleCan(role: TenantRole, capability: TenantCapability): boolean {
  const caps = TENANT_ROLE_CAPABILITIES[role];
  return caps === 'all' || caps.includes(capability);
}

export function isPlatformStaff(role: PlatformRole): boolean {
  return role === 'platform_owner' || role === 'platform_admin';
}

export type EntityOperation = 'create' | 'read' | 'update' | 'delete';

export interface PermissionContext {
  userId: string;
  appRole: AppRoleDef | null;
}

function entityPermission(role: AppRoleDef | null, entityKey: string): EntityPermissionDef | undefined {
  return role?.entityPermissions.find((p) => p.entityKey === entityKey);
}

export function canAccessPage(ctx: PermissionContext, pageId: string, def: ApplicationDefinition): boolean {
  const page = def.pages.find((p) => p.id === pageId);
  if (!page) return false;
  if (page.allowedRoleIds && page.allowedRoleIds.length > 0) {
    return ctx.appRole ? page.allowedRoleIds.includes(ctx.appRole.id) : false;
  }
  if (!ctx.appRole) return true; // pages without restrictions are open to app members
  return ctx.appRole.pageIds === 'all' || ctx.appRole.pageIds.includes(pageId);
}

export function canOperateOnEntity(ctx: PermissionContext, entityKey: string, op: EntityOperation): boolean {
  if (!ctx.appRole) return true; // tenant admins/builders without an app role
  const perm = entityPermission(ctx.appRole, entityKey);
  if (!perm) return false;
  return perm[op] && perm.recordScope !== 'none';
}

/**
 * Returns a record-level restriction for reads/updates. `own` limits to
 * records created by the user; `filtered` applies the scope filter.
 */
export function recordScopeFor(ctx: PermissionContext, entityKey: string): EntityPermissionDef['recordScope'] {
  if (!ctx.appRole) return 'all';
  return entityPermission(ctx.appRole, entityKey)?.recordScope ?? 'none';
}

export function fieldAccess(
  ctx: PermissionContext,
  entityKey: string,
  fieldKey: string,
): 'editable' | 'visible' | 'hidden' {
  if (!ctx.appRole) return 'editable';
  const perm = entityPermission(ctx.appRole, entityKey);
  if (!perm) return 'hidden';
  const override = perm.fieldOverrides?.find((o) => o.fieldKey === fieldKey);
  if (override) return override.access;
  return perm.update ? 'editable' : 'visible';
}
