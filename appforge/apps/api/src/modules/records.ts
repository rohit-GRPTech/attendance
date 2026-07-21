import { Router } from 'express';
import { z } from 'zod';
import {
  FILTER_OPERATORS,
  PLANS,
  canOperateOnEntity,
  recordScopeFor,
  type ApplicationDefinition,
  type AppRoleDef,
} from '@appforge/shared';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok, created } from '../utils/respond';
import { newId } from '../utils/ids';
import { getTenantCtx, requireAuth, requireTenant, type TenantContext } from '../middleware/context';
import { applyDefaults, buildRecordSchema } from '../services/record-schema';
import { dispatchWorkflows } from '../services/workflow-engine';
import { getPublishedDefinition } from '../services/definition-service';
import { recordAudit } from '../services/audit-service';

export const recordsRouter = Router({ mergeParams: true });
recordsRouter.use(requireAuth, requireTenant);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  sort: z.string().max(64).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  /** JSON-encoded array of {fieldKey, operator, value}. */
  filters: z.string().max(4000).optional(),
});

const filterSchema = z.array(
  z.object({
    fieldKey: z.string().max(64),
    operator: z.enum(FILTER_OPERATORS),
    value: z.unknown().optional(),
  }),
).max(20);

interface EntityContext {
  ctx: TenantContext;
  appId: string;
  entityKey: string;
  definition: ApplicationDefinition;
  entity: ApplicationDefinition['entities'][number];
  appRole: AppRoleDef | null;
}

/**
 * Resolves the application, its active definition and the caller's app-level
 * role. Builder-capable members use the draft definition; app users use the
 * published version only.
 */
async function resolveEntityContext(req: Parameters<typeof getTenantCtx>[0], mode: 'draft' | 'published' | 'auto'): Promise<EntityContext> {
  const ctx = getTenantCtx(req);
  const appId = String(req.params.appId);
  const entityKey = String(req.params.entityKey);
  const app = await getStore().getApplication(ctx.tenant.id, appId);
  if (!app) throw ApiError.notFound('Application not found.');

  const isBuilderRole = ['tenant_owner', 'tenant_admin', 'app_manager'].includes(ctx.membership.role);
  let definition: ApplicationDefinition | null = null;
  if (mode === 'draft' || (mode === 'auto' && isBuilderRole)) {
    definition = app.draftDefinition;
  } else {
    definition = await getPublishedDefinition(ctx.tenant.id, app);
    if (!definition && isBuilderRole) definition = app.draftDefinition;
  }
  if (!definition) throw ApiError.notFound('This application has not been published yet.');

  const entity = definition.entities.find((e) => e.key === entityKey);
  if (!entity) throw ApiError.notFound(`Data table "${entityKey}" does not exist in this application.`);

  // App users are constrained by the definition's default role permissions.
  const appRole = isBuilderRole
    ? null
    : definition.roles.find((r) => r.id === definition!.settings.defaultRoleId) ?? definition.roles.find((r) => r.isDefault) ?? null;

  return { ctx, appId, entityKey, definition, entity, appRole };
}

recordsRouter.get('/', async (req, res, next) => {
  try {
    const ec = await resolveEntityContext(req, 'auto');
    if (!canOperateOnEntity({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey, 'read')) {
      throw ApiError.forbidden('You do not have permission to view these records.');
    }
    const query = listQuerySchema.parse(req.query);
    const filters = query.filters ? filterSchema.parse(JSON.parse(query.filters)) : undefined;
    const scope = recordScopeFor({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey);
    const { rows, total } = await getStore().listRecords(ec.ctx.tenant.id, ec.appId, ec.entityKey, {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      sortFieldKey: query.sort,
      sortDirection: query.direction,
      filters: filters as never,
      createdByUserId: scope === 'own' ? ec.ctx.user.id : undefined,
    });
    ok(
      res,
      rows.map((r) => ({ id: r.id, data: r.data, createdAt: r.createdAt, updatedAt: r.updatedAt, createdByUserId: r.createdByUserId })),
      { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
    );
  } catch (err) {
    next(err);
  }
});

recordsRouter.post('/', async (req, res, next) => {
  try {
    const ec = await resolveEntityContext(req, 'auto');
    if (!canOperateOnEntity({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey, 'create')) {
      throw ApiError.forbidden('You do not have permission to create records here.');
    }
    const limits = PLANS[ec.ctx.tenant.planId].limits;
    if (limits.records !== -1) {
      const count = await getStore().countRecords(ec.ctx.tenant.id);
      if (count >= limits.records) {
        throw ApiError.planLimit(`Your plan allows up to ${limits.records.toLocaleString()} records. Upgrade to add more.`);
      }
    }
    const data = applyDefaults(ec.entity, buildRecordSchema(ec.entity, 'create').parse(req.body?.data ?? {}));
    const now = new Date().toISOString();
    const record = await getStore().createRecord({
      id: newId(), tenantId: ec.ctx.tenant.id, applicationId: ec.appId, entityKey: ec.entityKey,
      data, createdByUserId: ec.ctx.user.id, updatedByUserId: ec.ctx.user.id,
      createdAt: now, updatedAt: now, deletedAt: null,
    });
    await recordAudit({
      tenantId: ec.ctx.tenant.id, userId: ec.ctx.user.id, action: 'record.created',
      resourceType: ec.entityKey, resourceId: record.id, applicationId: ec.appId,
      summary: `Created ${ec.entity.name.toLowerCase()} "${String(data[ec.entity.displayFieldKey] ?? record.id)}"`,
    });
    await dispatchWorkflows(ec.definition, {
      tenantId: ec.ctx.tenant.id, applicationId: ec.appId, userId: ec.ctx.user.id,
      trigger: 'record_created', entityKey: ec.entityKey, record,
    });
    created(res, { id: record.id, data: record.data, createdAt: record.createdAt, updatedAt: record.updatedAt });
  } catch (err) {
    next(err);
  }
});

recordsRouter.get('/:recordId', async (req, res, next) => {
  try {
    const ec = await resolveEntityContext(req, 'auto');
    if (!canOperateOnEntity({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey, 'read')) {
      throw ApiError.forbidden('You do not have permission to view this record.');
    }
    const record = await getStore().getRecord(ec.ctx.tenant.id, ec.appId, String(req.params.recordId));
    if (!record || record.entityKey !== ec.entityKey) throw ApiError.notFound('Record not found.');
    const scope = recordScopeFor({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey);
    if (scope === 'own' && record.createdByUserId !== ec.ctx.user.id) throw ApiError.forbidden('You can only view your own records.');
    ok(res, { id: record.id, data: record.data, createdAt: record.createdAt, updatedAt: record.updatedAt });
  } catch (err) {
    next(err);
  }
});

recordsRouter.patch('/:recordId', async (req, res, next) => {
  try {
    const ec = await resolveEntityContext(req, 'auto');
    if (!canOperateOnEntity({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey, 'update')) {
      throw ApiError.forbidden('You do not have permission to update these records.');
    }
    const store = getStore();
    const existing = await store.getRecord(ec.ctx.tenant.id, ec.appId, String(req.params.recordId));
    if (!existing || existing.entityKey !== ec.entityKey) throw ApiError.notFound('Record not found.');
    const scope = recordScopeFor({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey);
    if (scope === 'own' && existing.createdByUserId !== ec.ctx.user.id) throw ApiError.forbidden('You can only edit your own records.');

    const patch = buildRecordSchema(ec.entity, 'update').parse(req.body?.data ?? {});
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const record = await store.updateRecord(ec.ctx.tenant.id, ec.appId, existing.id, {
      data: { ...existing.data, ...cleaned },
      updatedByUserId: ec.ctx.user.id,
    });
    await recordAudit({
      tenantId: ec.ctx.tenant.id, userId: ec.ctx.user.id, action: 'record.updated',
      resourceType: ec.entityKey, resourceId: existing.id, applicationId: ec.appId,
      summary: `Updated ${ec.entity.name.toLowerCase()} "${String(record?.data[ec.entity.displayFieldKey] ?? existing.id)}"`,
    });
    if (record) {
      await dispatchWorkflows(ec.definition, {
        tenantId: ec.ctx.tenant.id, applicationId: ec.appId, userId: ec.ctx.user.id,
        trigger: 'record_updated', entityKey: ec.entityKey, record,
      });
    }
    ok(res, { id: record?.id, data: record?.data, updatedAt: record?.updatedAt });
  } catch (err) {
    next(err);
  }
});

recordsRouter.delete('/:recordId', async (req, res, next) => {
  try {
    const ec = await resolveEntityContext(req, 'auto');
    if (!canOperateOnEntity({ userId: ec.ctx.user.id, appRole: ec.appRole }, ec.entityKey, 'delete')) {
      throw ApiError.forbidden('You do not have permission to delete these records.');
    }
    const store = getStore();
    const existing = await store.getRecord(ec.ctx.tenant.id, ec.appId, String(req.params.recordId));
    if (!existing || existing.entityKey !== ec.entityKey) throw ApiError.notFound('Record not found.');
    await store.updateRecord(ec.ctx.tenant.id, ec.appId, existing.id, {
      deletedAt: new Date().toISOString(),
      updatedByUserId: ec.ctx.user.id,
    });
    await recordAudit({
      tenantId: ec.ctx.tenant.id, userId: ec.ctx.user.id, action: 'record.deleted',
      resourceType: ec.entityKey, resourceId: existing.id, applicationId: ec.appId,
      summary: `Deleted a ${ec.entity.name.toLowerCase()} record`,
    });
    await dispatchWorkflows(ec.definition, {
      tenantId: ec.ctx.tenant.id, applicationId: ec.appId, userId: ec.ctx.user.id,
      trigger: 'record_deleted', entityKey: ec.entityKey, record: existing,
    });
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
