import type { AuditAction } from '@appforge/shared';
import { getStore } from '../storage';
import { newId } from '../utils/ids';

export async function recordAudit(input: {
  tenantId: string;
  userId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  summary: string;
  applicationId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await getStore().createAuditLog({
    id: newId(),
    tenantId: input.tenantId,
    applicationId: input.applicationId ?? null,
    userId: input.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    summary: input.summary,
    ipAddress: input.ipAddress ?? null,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  });
}
