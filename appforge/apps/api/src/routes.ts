import { Router } from 'express';
import { authRouter } from './modules/auth';
import { tenantsRouter } from './modules/tenants';
import { applicationsRouter } from './modules/applications';
import { recordsRouter } from './modules/records';
import { workflowsRouter } from './modules/workflows';
import { marketplaceRouter } from './modules/marketplace';
import { notificationsRouter } from './modules/notifications';
import { auditRouter } from './modules/audit';
import { aiRouter } from './modules/ai';
import { billingRouter } from './modules/billing';
import { dashboardRouter } from './modules/dashboard';
import { portalRouter } from './modules/portal';

/** Central API route configuration (mounted under /api/v1). */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/tenants', tenantsRouter);
apiRouter.use('/applications', applicationsRouter);
apiRouter.use('/applications/:appId/entities/:entityKey/records', recordsRouter);
apiRouter.use('/workflows', workflowsRouter);
apiRouter.use('/marketplace', marketplaceRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/ai', aiRouter);
apiRouter.use('/billing', billingRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/portal', portalRouter);
