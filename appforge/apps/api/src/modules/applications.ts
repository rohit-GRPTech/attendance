import { Router } from 'express';
import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  BUSINESS_CATEGORIES,
  CURRENT_SCHEMA_VERSION,
  PLANS,
  cloneDefinitionWithNewIds,
  type ApplicationDefinition,
} from '@appforge/shared';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok, created } from '../utils/respond';
import { newId, shortId, slugify } from '../utils/ids';
import { getTenantCtx, requireAuth, requireCapability, requireTenant } from '../middleware/context';
import { publishApplication, rollbackApplication, validateWithRegistry } from '../services/definition-service';
import { recordAudit } from '../services/audit-service';
import type { ApplicationRow } from '../storage/types';

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth, requireTenant);

function summarize(app: ApplicationRow) {
  const def = app.draftDefinition;
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    description: app.description,
    icon: app.icon,
    category: app.category,
    status: app.status,
    pageCount: def.pages.length,
    entityCount: def.entities.length,
    workflowCount: def.workflows.length,
    roleCount: def.roles.length,
    isPublished: Boolean(app.publishedVersionId),
    updatedAt: app.updatedAt,
    createdAt: app.createdAt,
  };
}

/** Blank-but-valid starter definition for the wizard's "start blank" path. */
function blankDefinition(name: string, slug: string, description: string, category: string, icon: string): ApplicationDefinition {
  const pageId = newId();
  const roleId = newId();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: {
      id: newId(), name, slug, description, icon,
      category: category as ApplicationDefinition['app']['category'],
      language: 'en', timezone: 'UTC', currency: 'USD', dateFormat: 'MMM d, yyyy',
    },
    entities: [],
    pages: [
      {
        id: pageId, name: 'Home', slug: 'home', type: 'dashboard', icon: 'layout-dashboard',
        showInNavigation: true, layout: 'single', isHome: true,
        components: [
          { id: newId(), type: 'heading', props: { text: `Welcome to ${name}`, level: 1 } },
          { id: newId(), type: 'paragraph', props: { text: 'Open the builder to add data tables, forms and dashboards.' } },
        ],
      },
    ],
    navigation: [{ id: newId(), label: 'Home', icon: 'layout-dashboard', pageId, order: 0 }],
    workflows: [],
    roles: [
      {
        id: roleId, key: 'member', name: 'Team member', isDefault: true, pageIds: 'all',
        entityPermissions: [], canExport: true, canImport: false, canManageUsers: false, canManageSettings: false,
      },
    ],
    theme: { primaryColor: '#4f46e5', radius: 'md', density: 'comfortable', mode: 'light' },
    settings: {
      allowSelfRegistration: false, defaultRoleId: roleId,
      localization: { language: 'en', dateFormat: 'MMM d, yyyy', currency: 'USD' },
      featureFlags: {},
    },
  };
}

applicationsRouter.get('/', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const query = z
      .object({
        search: z.string().max(200).optional(),
        status: z.enum(APPLICATION_STATUSES).optional(),
        category: z.enum(BUSINESS_CATEGORIES).optional(),
      })
      .parse(req.query);
    let apps = await getStore().listApplications(ctx.tenant.id);
    if (query.search) {
      const q = query.search.toLowerCase();
      apps = apps.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    if (query.status) apps = apps.filter((a) => a.status === query.status);
    if (query.category) apps = apps.filter((a) => a.category === query.category);
    ok(res, apps.map(summarize));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).default(''),
  category: z.enum(BUSINESS_CATEGORIES).default('custom'),
  icon: z.string().max(64).default('layout-grid'),
  /** Full definition when importing JSON or accepting an AI draft. */
  definition: z.unknown().optional(),
});

applicationsRouter.post('/', requireCapability('applications.create'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = createSchema.parse(req.body);
    const store = getStore();

    const limits = PLANS[ctx.tenant.planId].limits;
    const existing = await store.listApplications(ctx.tenant.id);
    if (limits.applications !== -1 && existing.length >= limits.applications) {
      throw ApiError.planLimit(`Your ${PLANS[ctx.tenant.planId].name} plan allows ${limits.applications} application(s). Upgrade to add more.`);
    }

    let slug = slugify(body.name);
    if (await store.getApplicationBySlug(ctx.tenant.id, slug)) slug = `${slug}-${shortId(4)}`;

    let definition: ApplicationDefinition;
    if (body.definition !== undefined) {
      const { definition: valid, issues } = validateWithRegistry(body.definition);
      if (!valid) throw ApiError.badRequest('The imported application definition is invalid.', issues);
      definition = cloneDefinitionWithNewIds(valid, newId, { name: body.name, slug });
      definition.app.description = body.description || definition.app.description;
    } else {
      definition = blankDefinition(body.name, slug, body.description, body.category, body.icon);
    }

    const now = new Date().toISOString();
    const app = await store.createApplication({
      id: newId(), tenantId: ctx.tenant.id, name: body.name, slug,
      description: body.description || definition.app.description,
      icon: body.icon, category: body.category, status: 'draft',
      draftDefinition: definition, publishedVersionId: null,
      createdByUserId: ctx.user.id, createdAt: now, updatedAt: now, deletedAt: null,
    });
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'application.created',
      resourceType: 'application', resourceId: app.id, applicationId: app.id,
      summary: `Created application "${app.name}"`,
    });
    created(res, summarize(app));
  } catch (err) {
    next(err);
  }
});

applicationsRouter.get('/:appId', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const app = await getStore().getApplication(ctx.tenant.id, req.params.appId as string);
    if (!app) throw ApiError.notFound('Application not found.');
    ok(res, { ...summarize(app), definition: app.draftDefinition });
  } catch (err) {
    next(err);
  }
});

/** Draft save from the builder — always validated before persisting. */
applicationsRouter.put('/:appId/definition', requireCapability('applications.build'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const { definition, issues } = validateWithRegistry(req.body);
    if (!definition) throw ApiError.badRequest('The application definition is invalid and was not saved.', issues);
    const app = await getStore().updateApplication(ctx.tenant.id, req.params.appId as string, {
      draftDefinition: definition,
      name: definition.app.name,
      description: definition.app.description,
      icon: definition.app.icon,
      category: definition.app.category,
    });
    if (!app) throw ApiError.notFound('Application not found.');
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'application.updated',
      resourceType: 'application', resourceId: app.id, applicationId: app.id,
      summary: `Saved draft of "${app.name}"`,
    });
    ok(res, { saved: true, issues });
  } catch (err) {
    next(err);
  }
});

/** Validation preview used by the publish dialog. */
applicationsRouter.post('/:appId/validate', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const app = await getStore().getApplication(ctx.tenant.id, req.params.appId as string);
    if (!app) throw ApiError.notFound('Application not found.');
    const { definition, issues } = validateWithRegistry(app.draftDefinition);
    ok(res, { valid: Boolean(definition), issues });
  } catch (err) {
    next(err);
  }
});

applicationsRouter.post('/:appId/publish', requireCapability('applications.publish'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const result = await publishApplication({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      applicationId: req.params.appId as string,
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
});

applicationsRouter.get('/:appId/versions', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const versions = await getStore().listApplicationVersions(ctx.tenant.id, req.params.appId as string);
    ok(res, versions.map((v) => ({ id: v.id, version: v.version, publishedByUserId: v.publishedByUserId, createdAt: v.createdAt })));
  } catch (err) {
    next(err);
  }
});

applicationsRouter.post('/:appId/rollback', requireCapability('applications.publish'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z.object({ versionId: z.string() }).parse(req.body);
    await rollbackApplication({
      tenantId: ctx.tenant.id, userId: ctx.user.id,
      applicationId: req.params.appId as string, versionId: body.versionId,
    });
    ok(res, { rolledBack: true });
  } catch (err) {
    next(err);
  }
});

applicationsRouter.post('/:appId/duplicate', requireCapability('applications.create'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const store = getStore();
    const app = await store.getApplication(ctx.tenant.id, req.params.appId as string);
    if (!app) throw ApiError.notFound('Application not found.');
    const name = `${app.name} (copy)`;
    let slug = slugify(name);
    if (await store.getApplicationBySlug(ctx.tenant.id, slug)) slug = `${slug}-${shortId(4)}`;
    const definition = cloneDefinitionWithNewIds(app.draftDefinition, newId, { name, slug });
    const now = new Date().toISOString();
    const copy = await store.createApplication({
      id: newId(), tenantId: ctx.tenant.id, name, slug, description: app.description,
      icon: app.icon, category: app.category, status: 'draft',
      draftDefinition: definition, publishedVersionId: null,
      createdByUserId: ctx.user.id, createdAt: now, updatedAt: now, deletedAt: null,
    });
    created(res, summarize(copy));
  } catch (err) {
    next(err);
  }
});

/** JSON export of the draft definition. */
applicationsRouter.get('/:appId/export', requireCapability('data.export'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const app = await getStore().getApplication(ctx.tenant.id, req.params.appId as string);
    if (!app) throw ApiError.notFound('Application not found.');
    ok(res, app.draftDefinition);
  } catch (err) {
    next(err);
  }
});

applicationsRouter.patch('/:appId', requireCapability('applications.build'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z.object({ status: z.enum(APPLICATION_STATUSES).optional(), name: z.string().min(2).max(120).optional() }).parse(req.body);
    const app = await getStore().updateApplication(ctx.tenant.id, req.params.appId as string, body);
    if (!app) throw ApiError.notFound('Application not found.');
    if (body.status === 'archived') {
      await recordAudit({
        tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'application.archived',
        resourceType: 'application', resourceId: app.id, applicationId: app.id,
        summary: `Archived "${app.name}"`,
      });
    }
    ok(res, summarize(app));
  } catch (err) {
    next(err);
  }
});

applicationsRouter.delete('/:appId', requireCapability('applications.delete'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const app = await getStore().updateApplication(ctx.tenant.id, req.params.appId as string, {
      deletedAt: new Date().toISOString(),
      status: 'archived',
    });
    if (!app) throw ApiError.notFound('Application not found.');
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'application.deleted',
      resourceType: 'application', resourceId: app.id, applicationId: app.id,
      summary: `Deleted "${app.name}"`,
    });
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
