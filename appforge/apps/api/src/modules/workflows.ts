import { Router } from 'express';
import { z } from 'zod';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok } from '../utils/respond';
import { getTenantCtx, requireAuth, requireTenant } from '../middleware/context';
import { dispatchWorkflows } from '../services/workflow-engine';

export const workflowsRouter = Router({ mergeParams: true });
workflowsRouter.use(requireAuth, requireTenant);

/** Execution history for a workspace or one application. */
workflowsRouter.get('/runs', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const query = z.object({ applicationId: z.string().optional() }).parse(req.query);
    const runs = await getStore().listWorkflowRuns(ctx.tenant.id, query.applicationId);
    ok(res, runs);
  } catch (err) {
    next(err);
  }
});

/** Manual/button-triggered workflow execution ("test run"). */
workflowsRouter.post('/applications/:appId/workflows/:workflowId/run', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const app = await getStore().getApplication(ctx.tenant.id, String(req.params.appId));
    if (!app) throw ApiError.notFound('Application not found.');
    const workflowId = String(req.params.workflowId);
    const workflow = app.draftDefinition.workflows.find((w) => w.id === workflowId);
    if (!workflow) throw ApiError.notFound('Workflow not found.');
    await dispatchWorkflows(app.draftDefinition, {
      tenantId: ctx.tenant.id,
      applicationId: app.id,
      userId: ctx.user.id,
      trigger: 'button_clicked',
      workflowId,
    });
    const runs = await getStore().listWorkflowRuns(ctx.tenant.id, app.id);
    ok(res, { triggered: true, lastRun: runs[0] ?? null });
  } catch (err) {
    next(err);
  }
});
