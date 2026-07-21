import { Router } from 'express';
import { canAccessPage } from '@appforge/shared';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok } from '../utils/respond';
import { getTenantCtx, requireAuth, requireTenant } from '../middleware/context';
import { getPublishedDefinition } from '../services/definition-service';

export const portalRouter = Router();
portalRouter.use(requireAuth, requireTenant);

/** Installed applications available to the signed-in member. */
portalRouter.get('/applications', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const apps = await getStore().listApplications(ctx.tenant.id);
    const published = apps.filter((a) => a.status === 'published' && a.publishedVersionId);
    ok(
      res,
      published.map((a) => ({
        id: a.id, name: a.name, slug: a.slug, description: a.description,
        icon: a.icon, category: a.category, updatedAt: a.updatedAt,
        role: ctx.membership.role,
      })),
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Runtime resolution: loads the immutable published version, validates it and
 * returns the definition with navigation filtered to the caller's app role.
 */
portalRouter.get('/applications/:appSlug', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const app = await getStore().getApplicationBySlug(ctx.tenant.id, String(req.params.appSlug));
    if (!app) throw ApiError.notFound('Application not found.');
    const definition = await getPublishedDefinition(ctx.tenant.id, app);
    if (!definition) throw ApiError.notFound('This application has not been published yet.');

    const isBuilderRole = ['tenant_owner', 'tenant_admin', 'app_manager'].includes(ctx.membership.role);
    const appRole = isBuilderRole
      ? null
      : definition.roles.find((r) => r.id === definition.settings.defaultRoleId) ??
        definition.roles.find((r) => r.isDefault) ?? null;

    const permCtx = { userId: ctx.user.id, appRole };
    const allowedPageIds = new Set(
      definition.pages.filter((p) => canAccessPage(permCtx, p.id, definition)).map((p) => p.id),
    );
    ok(res, {
      applicationId: app.id,
      definition: {
        ...definition,
        navigation: definition.navigation.filter((n) => allowedPageIds.has(n.pageId)),
      },
      permissions: {
        appRole: appRole ? { id: appRole.id, name: appRole.name, key: appRole.key } : null,
        allowedPageIds: [...allowedPageIds],
        entityPermissions: appRole?.entityPermissions ?? null,
        isBuilder: isBuilderRole,
      },
    });
  } catch (err) {
    next(err);
  }
});
