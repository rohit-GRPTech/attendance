import { Router } from 'express';
import { z } from 'zod';
import { getStore } from '../storage';
import { ok } from '../utils/respond';
import { getTenantCtx, requireAuth, requireCapability, requireTenant } from '../middleware/context';

export const auditRouter = Router();
auditRouter.use(requireAuth, requireTenant, requireCapability('audit.view'));

auditRouter.get('/', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const query = z
      .object({
        applicationId: z.string().optional(),
        action: z.string().max(64).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);
    const all = await getStore().listAuditLogs(ctx.tenant.id, {
      applicationId: query.applicationId,
      action: query.action,
    });
    const start = (query.page - 1) * query.pageSize;
    const rows = all.slice(start, start + query.pageSize);
    const users = new Map<string, string>();
    for (const row of rows) {
      if (row.userId && !users.has(row.userId)) {
        const user = await getStore().getUserById(row.userId);
        users.set(row.userId, user?.fullName ?? 'Unknown user');
      }
    }
    ok(
      res,
      rows.map((r) => ({ ...r, userName: r.userId ? users.get(r.userId) : null })),
      { page: query.page, pageSize: query.pageSize, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / query.pageSize)) },
    );
  } catch (err) {
    next(err);
  }
});
