import { Router } from 'express';
import { getStore } from '../storage';
import { ok } from '../utils/respond';
import { getTenantCtx, requireAuth, requireTenant } from '../middleware/context';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireTenant);

/** Aggregated workspace overview powering the main dashboard. */
dashboardRouter.get('/', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const store = getStore();
    const [apps, members, runs, records, purchases, audit] = await Promise.all([
      store.listApplications(ctx.tenant.id),
      store.listMembershipsForTenant(ctx.tenant.id),
      store.listWorkflowRuns(ctx.tenant.id),
      store.countRecords(ctx.tenant.id),
      store.listPurchases(ctx.tenant.id),
      store.listAuditLogs(ctx.tenant.id),
    ]);
    const sellerTemplates = await store.listTemplates({ creatorTenantId: ctx.tenant.id });
    const templateSales = sellerTemplates.reduce((acc, t) => acc + t.installCount, 0);
    const templateRevenue = sellerTemplates.reduce((acc, t) => acc + t.installCount * t.priceUsd, 0);

    ok(res, {
      totals: {
        applications: apps.length,
        publishedApplications: apps.filter((a) => a.status === 'published').length,
        draftApplications: apps.filter((a) => a.status === 'draft').length,
        activeUsers: members.length,
        workflowRuns: runs.length,
        records,
        templateSales,
        monthlyRecurringRevenueUsd: templateRevenue > 0 ? Math.round(templateRevenue / 12) : 0,
      },
      statusDistribution: ['draft', 'testing', 'published', 'archived'].map((status) => ({
        status,
        count: apps.filter((a) => a.status === status).length,
      })),
      recentApplications: apps.slice(0, 5).map((a) => ({
        id: a.id, name: a.name, icon: a.icon, status: a.status, updatedAt: a.updatedAt,
        pageCount: a.draftDefinition.pages.length, entityCount: a.draftDefinition.entities.length,
      })),
      recentActivity: audit.slice(0, 8),
      workflowPerformance: {
        succeeded: runs.filter((r) => r.status === 'succeeded').length,
        failed: runs.filter((r) => r.status === 'failed').length,
        recent: runs.slice(0, 5),
      },
      recentPurchases: purchases.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});
