import { Router } from 'express';
import { z } from 'zod';
import { PLAN_IDS, PLANS } from '@appforge/shared';
import { getStore } from '../storage';
import { ok } from '../utils/respond';
import { getTenantCtx, requireAuth, requireCapability, requireTenant } from '../middleware/context';
import { getBillingProvider } from '../adapters/billing';
import { recordAudit } from '../services/audit-service';

export const billingRouter = Router();

billingRouter.get('/plans', (_req, res) => {
  ok(res, PLAN_IDS.map((id) => ({ id, ...PLANS[id] })));
});

billingRouter.use(requireAuth, requireTenant);

billingRouter.get('/subscription', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const store = getStore();
    const subscription = await store.getSubscription(ctx.tenant.id);
    const apps = await store.listApplications(ctx.tenant.id);
    const members = await store.listMembershipsForTenant(ctx.tenant.id);
    const records = await store.countRecords(ctx.tenant.id);
    const generations = (await store.listAiGenerations(ctx.tenant.id)).filter(
      (g) => Date.parse(g.createdAt) > Date.now() - 30 * 86400_000,
    );
    ok(res, {
      planId: ctx.tenant.planId,
      plan: PLANS[ctx.tenant.planId],
      subscription,
      usage: {
        applications: apps.length,
        users: members.length,
        records,
        aiGenerationsThisMonth: generations.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Placeholder upgrade: applies the plan directly; a real provider returns a checkout URL. */
billingRouter.post('/upgrade', requireCapability('billing.manage'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z.object({ planId: z.enum(PLAN_IDS) }).parse(req.body);
    const { checkoutUrl } = await getBillingProvider().createCheckout(ctx.tenant.id, body.planId);
    await getStore().updateTenant(ctx.tenant.id, { planId: body.planId });
    await getStore().updateSubscription(ctx.tenant.id, { planId: body.planId, status: 'active' });
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'settings.changed',
      resourceType: 'subscription', summary: `Changed plan to ${PLANS[body.planId].name}`,
    });
    ok(res, { checkoutUrl, planId: body.planId });
  } catch (err) {
    next(err);
  }
});
