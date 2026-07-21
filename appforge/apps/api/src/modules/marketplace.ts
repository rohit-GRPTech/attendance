import { Router } from 'express';
import { z } from 'zod';
import { BUSINESS_CATEGORIES, PLANS, cloneDefinitionWithNewIds } from '@appforge/shared';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok, created } from '../utils/respond';
import { newId, shortId, slugify } from '../utils/ids';
import { getTenantCtx, requireAuth, requireCapability, requireTenant } from '../middleware/context';
import { recordAudit } from '../services/audit-service';
import type { TemplateRow } from '../storage/types';

export const marketplaceRouter = Router();
marketplaceRouter.use(requireAuth, requireTenant);

function listingCard(t: TemplateRow) {
  return {
    id: t.id, name: t.name, slug: t.slug, shortDescription: t.shortDescription,
    category: t.category, creatorName: t.creatorName, priceUsd: t.priceUsd,
    status: t.status, featured: t.featured, installCount: t.installCount,
    rating: t.rating, reviewCount: t.reviewCount, version: t.version, updatedAt: t.updatedAt,
  };
}

marketplaceRouter.get('/templates', async (req, res, next) => {
  try {
    const query = z
      .object({ category: z.enum(BUSINESS_CATEGORIES).optional(), search: z.string().max(200).optional() })
      .parse(req.query);
    let templates = await getStore().listTemplates({ status: 'published' });
    if (query.category) templates = templates.filter((t) => t.category === query.category);
    if (query.search) {
      const q = query.search.toLowerCase();
      templates = templates.filter((t) => t.name.toLowerCase().includes(q) || t.shortDescription.toLowerCase().includes(q));
    }
    ok(res, templates.map(listingCard));
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get('/templates/:templateId', async (req, res, next) => {
  try {
    const template = await getStore().getTemplateById(String(req.params.templateId));
    if (!template || template.status !== 'published') throw ApiError.notFound('Template not found.');
    const def = template.definition;
    ok(res, {
      ...listingCard(template),
      longDescription: template.longDescription,
      screenshots: template.screenshots,
      contents: {
        entities: def.entities.map((e) => ({ key: e.key, name: e.pluralName, fieldCount: e.fields.length })),
        pages: def.pages.map((p) => ({ slug: p.slug, name: p.name, type: p.type })),
        workflows: def.workflows.map((w) => ({ id: w.id, name: w.name })),
        roles: def.roles.map((r) => ({ id: r.id, name: r.name })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Purchase (billing placeholder) + install: clones the template into a tenant-owned application. */
marketplaceRouter.post('/templates/:templateId/install', requireCapability('marketplace.install'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z.object({ applicationName: z.string().min(2).max(120).optional() }).parse(req.body ?? {});
    const store = getStore();
    const template = await store.getTemplateById(String(req.params.templateId));
    if (!template || template.status !== 'published') throw ApiError.notFound('Template not found.');

    const limits = PLANS[ctx.tenant.planId].limits;
    const existing = await store.listApplications(ctx.tenant.id);
    if (limits.applications !== -1 && existing.length >= limits.applications) {
      throw ApiError.planLimit('Your plan application limit has been reached. Upgrade to install more applications.');
    }

    const name = body.applicationName ?? template.name;
    let slug = slugify(name);
    if (await store.getApplicationBySlug(ctx.tenant.id, slug)) slug = `${slug}-${shortId(4)}`;
    const definition = cloneDefinitionWithNewIds(template.definition, newId, { name, slug });

    const now = new Date().toISOString();
    const app = await store.createApplication({
      id: newId(), tenantId: ctx.tenant.id, name, slug,
      description: template.shortDescription, icon: definition.app.icon, category: template.category,
      status: 'draft', draftDefinition: definition, publishedVersionId: null,
      createdByUserId: ctx.user.id, createdAt: now, updatedAt: now, deletedAt: null,
    });
    const purchase = await store.createPurchase({
      id: newId(), tenantId: ctx.tenant.id, templateId: template.id, templateName: template.name,
      purchasedByUserId: ctx.user.id, pricePaidUsd: template.priceUsd, installedApplicationId: app.id, createdAt: now,
    });
    await store.updateTemplate(template.id, { installCount: template.installCount + 1 });
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'template.installed',
      resourceType: 'template', resourceId: template.id, applicationId: app.id,
      summary: `Installed template "${template.name}" as "${name}"`,
    });
    created(res, { applicationId: app.id, purchaseId: purchase.id });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get('/purchases', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    ok(res, await getStore().listPurchases(ctx.tenant.id));
  } catch (err) {
    next(err);
  }
});

/** Seller dashboard: templates created from this workspace plus sales stats. */
marketplaceRouter.get('/seller/overview', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const templates = await getStore().listTemplates({ creatorTenantId: ctx.tenant.id });
    const totals = templates.reduce(
      (acc, t) => ({
        installs: acc.installs + t.installCount,
        revenue: acc.revenue + t.installCount * t.priceUsd,
      }),
      { installs: 0, revenue: 0 },
    );
    ok(res, {
      templates: templates.map(listingCard),
      totalTemplates: templates.length,
      publishedTemplates: templates.filter((t) => t.status === 'published').length,
      pendingReview: templates.filter((t) => t.status === 'pending_review').length,
      totalInstalls: totals.installs,
      estimatedRevenueUsd: totals.revenue,
    });
  } catch (err) {
    next(err);
  }
});

/** Publish one of the tenant's applications as a marketplace template (structure only). */
marketplaceRouter.post('/seller/templates', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const limits = PLANS[ctx.tenant.planId].limits;
    if (!limits.marketplacePublishing) {
      throw ApiError.planLimit('Marketplace publishing requires the Business plan or higher.');
    }
    const body = z
      .object({
        applicationId: z.string(),
        name: z.string().min(2).max(200),
        shortDescription: z.string().min(10).max(300),
        longDescription: z.string().max(5000).default(''),
        priceUsd: z.coerce.number().min(0).max(9999).default(0),
      })
      .parse(req.body);
    const store = getStore();
    const app = await store.getApplication(ctx.tenant.id, body.applicationId);
    if (!app) throw ApiError.notFound('Application not found.');

    // Only structure is shared — the definition never contains customer records.
    const definition = cloneDefinitionWithNewIds(app.draftDefinition, newId);

    let slug = slugify(body.name);
    if ((await store.listTemplates()).some((t) => t.slug === slug)) slug = `${slug}-${shortId(4)}`;
    const now = new Date().toISOString();
    const template = await store.createTemplate({
      id: newId(), creatorTenantId: ctx.tenant.id, creatorUserId: ctx.user.id,
      creatorName: ctx.user.fullName, name: body.name, slug,
      shortDescription: body.shortDescription, longDescription: body.longDescription,
      category: app.category, priceUsd: body.priceUsd, status: 'pending_review',
      featured: false, installCount: 0, rating: 0, reviewCount: 0,
      definition, screenshots: [], version: '1.0.0', createdAt: now, updatedAt: now,
    });
    created(res, listingCard(template));
  } catch (err) {
    next(err);
  }
});
