import type { ApplicationDefinition, WorkflowDef, WorkflowNodeDef, WorkflowTriggerType } from '@appforge/shared';
import { WORKFLOW_MAX_NODES } from '@appforge/shared';
import { getStore } from '../storage';
import type { RecordRow, WorkflowRunRow } from '../storage/types';
import { newId } from '../utils/ids';
import { getEmailAdapter } from '../adapters/email';
import { recordAudit } from './audit-service';

interface WorkflowEvent {
  tenantId: string;
  applicationId: string;
  userId: string;
  trigger: WorkflowTriggerType;
  entityKey?: string;
  record?: RecordRow;
  /** Explicit workflow id for button-triggered runs. */
  workflowId?: string;
}

interface StepResult {
  nodeId: string;
  nodeType: string;
  status: 'succeeded' | 'skipped' | 'failed';
  detail?: string;
}

/**
 * Declarative workflow executor. Nodes are validated types with JSON config —
 * no user code is ever evaluated. Traversal is breadth-limited and acyclic
 * (publish validation rejects cycles; the engine also hard-caps steps).
 */
export async function dispatchWorkflows(definition: ApplicationDefinition, event: WorkflowEvent): Promise<void> {
  const candidates = definition.workflows.filter((wf) => {
    if (wf.status !== 'active') return false;
    if (event.workflowId) return wf.id === event.workflowId;
    return wf.trigger.type === event.trigger && (!wf.trigger.entityKey || wf.trigger.entityKey === event.entityKey);
  });
  for (const wf of candidates) {
    await runWorkflow(wf, event).catch((err) => {
      // Workflow failures are recorded on the run, never crash the request.
      // eslint-disable-next-line no-console
      console.error(`workflow ${wf.id} failed:`, err);
    });
  }
}

async function runWorkflow(wf: WorkflowDef, event: WorkflowEvent): Promise<void> {
  const startedAt = new Date().toISOString();
  const steps: StepResult[] = [];
  let error: string | null = null;

  const nodesById = new Map(wf.nodes.map((n) => [n.id, n]));
  const outgoing = (nodeId: string, branch?: string) =>
    wf.edges
      .filter((e) => e.sourceNodeId === nodeId && (branch === undefined || (e.branch ?? 'true') === branch))
      .map((e) => nodesById.get(e.targetNodeId))
      .filter((n): n is WorkflowNodeDef => Boolean(n));

  const start = wf.nodes.find((n) => n.type === 'trigger') ?? wf.nodes[0];
  try {
    if (!start) throw new Error('Workflow has no nodes');
    let frontier: WorkflowNodeDef[] = [start];
    let executed = 0;
    while (frontier.length > 0) {
      const next: WorkflowNodeDef[] = [];
      for (const node of frontier) {
        if (executed++ > WORKFLOW_MAX_NODES) throw new Error('Workflow exceeded the maximum step limit');
        const result = await executeNode(node, event);
        steps.push(result);
        if (result.status === 'failed') throw new Error(result.detail ?? `Step ${node.type} failed`);
        if (isConditionNode(node)) {
          next.push(...outgoing(node.id, result.detail === 'false' ? 'false' : 'true'));
        } else {
          next.push(...outgoing(node.id));
        }
      }
      frontier = next;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const run: WorkflowRunRow = {
    id: newId(),
    tenantId: event.tenantId,
    applicationId: event.applicationId,
    workflowId: wf.id,
    workflowName: wf.name,
    triggerType: event.workflowId ? 'button_clicked' : event.trigger,
    status: error ? 'failed' : 'succeeded',
    steps: steps.map(({ nodeId, nodeType, status, detail }) => ({ nodeId, nodeType, status, detail })),
    error,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  await getStore().createWorkflowRun(run);
  await recordAudit({
    tenantId: event.tenantId,
    userId: event.userId,
    action: 'workflow.executed',
    resourceType: 'workflow',
    resourceId: wf.id,
    applicationId: event.applicationId,
    summary: `Workflow "${wf.name}" ${error ? 'failed' : 'ran'}`,
  });
}

function isConditionNode(node: WorkflowNodeDef): boolean {
  return ['if_else', 'compare_field', 'record_exists', 'user_has_role', 'date_condition', 'and_group', 'or_group'].includes(node.type);
}

async function executeNode(node: WorkflowNodeDef, event: WorkflowEvent): Promise<StepResult> {
  const cfg = node.config;
  const base = { nodeId: node.id, nodeType: node.type };
  switch (node.type) {
    case 'trigger':
      return { ...base, status: 'succeeded' };

    case 'if_else':
    case 'compare_field': {
      const fieldKey = String(cfg.fieldKey ?? '');
      const expected = cfg.value;
      const actual = event.record?.data[fieldKey];
      const operator = String(cfg.operator ?? 'eq');
      const pass =
        operator === 'neq'
          ? String(actual ?? '') !== String(expected ?? '')
          : String(actual ?? '') === String(expected ?? '');
      return { ...base, status: 'succeeded', detail: pass ? 'true' : 'false' };
    }

    case 'record_exists': {
      const entityKey = String(cfg.entityKey ?? '');
      const count = await getStore().countRecords(event.tenantId, event.applicationId, entityKey);
      return { ...base, status: 'succeeded', detail: count > 0 ? 'true' : 'false' };
    }

    case 'create_notification': {
      await getStore().createNotification({
        id: newId(),
        tenantId: event.tenantId,
        userId: String(cfg.userId ?? event.userId),
        kind: 'workflow',
        title: String(cfg.title ?? 'Automation update'),
        body: interpolate(String(cfg.message ?? ''), event.record),
        readAt: null,
        createdAt: new Date().toISOString(),
      });
      return { ...base, status: 'succeeded' };
    }

    case 'send_email': {
      const to = String(cfg.to ?? '');
      if (!to) return { ...base, status: 'skipped', detail: 'No recipient configured' };
      await getEmailAdapter().send({
        to,
        subject: String(cfg.subject ?? 'Automation update'),
        text: interpolate(String(cfg.body ?? ''), event.record),
      });
      return { ...base, status: 'succeeded' };
    }

    case 'update_record':
    case 'change_status': {
      if (!event.record) return { ...base, status: 'skipped', detail: 'No record in context' };
      const patchField = String(cfg.fieldKey ?? (node.type === 'change_status' ? 'status' : ''));
      if (!patchField) return { ...base, status: 'skipped', detail: 'No field configured' };
      await getStore().updateRecord(event.tenantId, event.applicationId, event.record.id, {
        data: { ...event.record.data, [patchField]: cfg.value as never },
        updatedByUserId: event.userId,
      });
      return { ...base, status: 'succeeded' };
    }

    case 'create_record': {
      const entityKey = String(cfg.entityKey ?? '');
      const data = (cfg.data && typeof cfg.data === 'object' ? cfg.data : {}) as Record<string, unknown>;
      if (!entityKey) return { ...base, status: 'skipped', detail: 'No entity configured' };
      const now = new Date().toISOString();
      await getStore().createRecord({
        id: newId(), tenantId: event.tenantId, applicationId: event.applicationId, entityKey,
        data, createdByUserId: event.userId, updatedByUserId: event.userId,
        createdAt: now, updatedAt: now, deletedAt: null,
      });
      return { ...base, status: 'succeeded' };
    }

    case 'add_audit_entry': {
      await recordAudit({
        tenantId: event.tenantId, userId: event.userId, action: 'workflow.executed',
        resourceType: 'workflow_note', applicationId: event.applicationId,
        summary: String(cfg.summary ?? 'Workflow note'),
      });
      return { ...base, status: 'succeeded' };
    }

    case 'delay':
    case 'approval_request':
    case 'send_webhook':
    case 'assign_user':
      // Structured placeholders: recorded in the run so behaviour is visible.
      return { ...base, status: 'skipped', detail: `${node.type} is not executed in the MVP runtime` };

    default:
      return { ...base, status: 'skipped', detail: `Unsupported node type ${node.type}` };
  }
}

/** Replaces {{field_key}} tokens with record values — plain text only. */
function interpolate(template: string, record?: RecordRow): string {
  if (!record) return template;
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => String(record.data[key] ?? ''));
}
