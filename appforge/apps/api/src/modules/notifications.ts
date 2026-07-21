import { Router } from 'express';
import { getStore } from '../storage';
import { ok } from '../utils/respond';
import { getTenantCtx, requireAuth, requireTenant } from '../middleware/context';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, requireTenant);

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const rows = await getStore().listNotifications(ctx.tenant.id, ctx.user.id);
    ok(res, rows, { unread: rows.filter((n) => !n.readAt).length });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    ok(res, await getStore().updateNotification(ctx.tenant.id, String(req.params.id), { readAt: new Date().toISOString() }));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    await getStore().markAllNotificationsRead(ctx.tenant.id, ctx.user.id);
    ok(res, { done: true });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    await getStore().deleteNotification(ctx.tenant.id, String(req.params.id));
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
