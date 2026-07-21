import {
  migrateDefinition,
  validateApplicationDefinition,
  isRegisteredComponentType,
  type ApplicationDefinition,
  type DefinitionIssue,
} from '@appforge/shared';
import { ApiError } from '../utils/errors';
import { getStore } from '../storage';
import type { ApplicationRow } from '../storage/types';
import { newId } from '../utils/ids';
import { recordAudit } from './audit-service';

/**
 * Definition lifecycle service: validation (structure + registry), publish
 * (immutable version + runtime pointer) and rollback.
 */
export function validateWithRegistry(raw: unknown): { definition: ApplicationDefinition | null; issues: DefinitionIssue[] } {
  const migrated = migrateDefinition(raw);
  const { definition, issues } = validateApplicationDefinition(migrated);
  if (definition) {
    const walk = (nodes: ApplicationDefinition['pages'][number]['components'], pageSlug: string) => {
      for (const node of nodes) {
        if (!isRegisteredComponentType(node.type)) {
          issues.push({
            path: `pages.${pageSlug}.components.${node.id}`,
            message: `Component type "${node.type}" is not in the component registry`,
            severity: 'error',
          });
        }
        if (node.children) walk(node.children, pageSlug);
      }
    };
    for (const page of definition.pages) walk(page.components, page.slug);
  }
  const hasErrors = issues.some((i) => i.severity === 'error');
  return { definition: hasErrors ? null : definition, issues };
}

export async function getPublishedDefinition(tenantId: string, app: ApplicationRow): Promise<ApplicationDefinition | null> {
  if (!app.publishedVersionId) return null;
  const version = await getStore().getApplicationVersion(tenantId, app.publishedVersionId);
  if (!version) return null;
  const { definition } = validateWithRegistry(version.definition);
  return definition;
}

export async function publishApplication(input: {
  tenantId: string;
  userId: string;
  applicationId: string;
}): Promise<{ versionId: string; version: number; issues: DefinitionIssue[] }> {
  const store = getStore();
  const app = await store.getApplication(input.tenantId, input.applicationId);
  if (!app) throw ApiError.notFound('Application not found.');

  const { definition, issues } = validateWithRegistry(app.draftDefinition);
  if (!definition) {
    throw ApiError.badRequest('The application cannot be published until validation issues are fixed.', issues);
  }

  const versions = await store.listApplicationVersions(input.tenantId, input.applicationId);
  const nextVersion = (versions[0]?.version ?? 0) + 1;
  const version = await store.createApplicationVersion({
    id: newId(),
    tenantId: input.tenantId,
    applicationId: input.applicationId,
    version: nextVersion,
    definition,
    publishedByUserId: input.userId,
    createdAt: new Date().toISOString(),
  });
  await store.updateApplication(input.tenantId, input.applicationId, {
    publishedVersionId: version.id,
    status: 'published',
  });
  await recordAudit({
    tenantId: input.tenantId,
    userId: input.userId,
    action: 'application.published',
    resourceType: 'application',
    resourceId: input.applicationId,
    applicationId: input.applicationId,
    summary: `Published ${app.name} version ${nextVersion}`,
  });
  return { versionId: version.id, version: nextVersion, issues };
}

export async function rollbackApplication(input: {
  tenantId: string;
  userId: string;
  applicationId: string;
  versionId: string;
}): Promise<void> {
  const store = getStore();
  const app = await store.getApplication(input.tenantId, input.applicationId);
  if (!app) throw ApiError.notFound('Application not found.');
  const version = await store.getApplicationVersion(input.tenantId, input.versionId);
  if (!version || version.applicationId !== input.applicationId) {
    throw ApiError.notFound('Version not found.');
  }
  await store.updateApplication(input.tenantId, input.applicationId, { publishedVersionId: version.id });
  await recordAudit({
    tenantId: input.tenantId,
    userId: input.userId,
    action: 'application.published',
    resourceType: 'application',
    resourceId: input.applicationId,
    applicationId: input.applicationId,
    summary: `Rolled back ${app.name} to version ${version.version}`,
  });
}
