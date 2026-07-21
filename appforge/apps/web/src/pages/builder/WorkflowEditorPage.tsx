import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, applyNodeChanges,
  type Edge, type Node, type NodeChange, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Play, Plus, Save, Trash2 } from 'lucide-react';
import {
  WORKFLOW_NODE_TYPES, WORKFLOW_TRIGGERS,
  type ApplicationDefinition, type WorkflowDef, type WorkflowNodeDef,
} from '@appforge/shared';
import { api } from '@/lib/api';
import { routes } from '@/routes';
import { titleCase } from '@/lib/utils';
import { useApplication, useSaveDefinition } from '@/features/applications/api';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select, Textarea } from '@/components/ui/input';
import { Card, ErrorState, PageSkeleton, StatusBadge } from '@/components/ui/surfaces';
import { useToast } from '@/components/ui/overlays';

interface WorkflowRun {
  id: string; workflowId: string; workflowName: string; status: string;
  startedAt: string; error: string | null;
  steps: Array<{ nodeId: string; nodeType: string; status: string; detail?: string }>;
}

const conditionTypes = ['if_else', 'compare_field', 'record_exists', 'user_has_role', 'date_condition', 'and_group', 'or_group'];

export function WorkflowEditorPage() {
  const { appId = '', workflowId = '' } = useParams();
  const app = useApplication(appId);

  if (app.isLoading) return <div className="p-6"><PageSkeleton /></div>;
  if (app.isError || !app.data) return <div className="p-6"><ErrorState message="We could not load this application." onRetry={() => app.refetch()} /></div>;

  const definition = app.data.data.definition;
  const workflow = definition.workflows.find((w) => w.id === workflowId);
  if (!workflow) return <div className="p-6"><ErrorState message="This automation no longer exists." /></div>;

  return <WorkflowEditorInner key={workflowId} appId={appId} definition={definition} initial={workflow} />;
}

function WorkflowEditorInner({ appId, definition, initial }: { appId: string; definition: ApplicationDefinition; initial: WorkflowDef }) {
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveDefinition(appId);
  const [workflow, setWorkflow] = useState<WorkflowDef>(initial);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ['workflow-runs', appId],
    queryFn: () => api.get<WorkflowRun[]>(`/workflows/runs?applicationId=${appId}`),
  });

  const flowNodes: Node[] = useMemo(
    () =>
      workflow.nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: { label: `${n.label ?? titleCase(n.type)}` },
        type: 'default',
        style: {
          borderRadius: 8,
          border: selectedNodeId === n.id ? '2px solid hsl(243 75% 59%)' : '1px solid hsl(220 13% 85%)',
          background: n.type === 'trigger' ? 'hsl(226 100% 96%)' : conditionTypes.includes(n.type) ? 'hsl(36 92% 94%)' : 'white',
          fontSize: 12,
          padding: 6,
          width: 180,
        },
      })),
    [workflow.nodes, selectedNodeId],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      workflow.edges.map((e) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        label: e.branch,
        animated: true,
      })),
    [workflow.edges],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setWorkflow((wf) => {
      const updated = applyNodeChanges(changes, wf.nodes.map((n) => ({ id: n.id, position: n.position, data: {} })) as Node[]);
      const positions = new Map(updated.map((n) => [n.id, n.position]));
      return { ...wf, nodes: wf.nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })) };
    });
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setWorkflow((wf) => ({
      ...wf,
      edges: [
        ...wf.edges,
        { id: crypto.randomUUID(), sourceNodeId: connection.source, targetNodeId: connection.target },
      ],
    }));
  }, []);

  const addNode = (type: WorkflowNodeDef['type']) => {
    const id = crypto.randomUUID();
    setWorkflow((wf) => ({
      ...wf,
      nodes: [
        ...wf.nodes,
        { id, type, label: titleCase(type), config: {}, position: { x: 320, y: 60 + wf.nodes.length * 70 } },
      ],
    }));
    setSelectedNodeId(id);
  };

  const removeNode = (nodeId: string) => {
    setWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.filter((n) => n.id !== nodeId),
      edges: wf.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
    }));
    setSelectedNodeId(null);
  };

  const updateNodeConfig = (nodeId: string, patch: Record<string, unknown>) => {
    setWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.map((n) => (n.id === nodeId ? { ...n, config: { ...n.config, ...patch } } : n)),
    }));
  };

  const persist = useMutation({
    mutationFn: () => {
      const nextDefinition: ApplicationDefinition = {
        ...definition,
        workflows: definition.workflows.map((w) => (w.id === workflow.id ? workflow : w)),
      };
      return save.mutateAsync(nextDefinition);
    },
    onSuccess: () => toast.success('Automation saved.'),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save the automation.'),
  });

  const testRun = useMutation({
    mutationFn: async () => {
      await persist.mutateAsync();
      return api.post(`/workflows/applications/${appId}/workflows/${workflow.id}/run`);
    },
    onSuccess: () => {
      toast.success('Test run finished — see execution history.');
      void runs.refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Test run failed.'),
  });

  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const workflowRuns = (runs.data?.data ?? []).filter((r) => r.workflowId === workflow.id);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-13 shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="iconSm" onClick={() => navigate(routes.builder(appId))} aria-label="Back to builder"><ArrowLeft /></Button>
        <Input
          className="w-56 font-medium"
          value={workflow.name}
          onChange={(e) => setWorkflow((wf) => ({ ...wf, name: e.target.value }))}
          aria-label="Automation name"
        />
        <StatusBadge status={workflow.status} />
        <div className="ml-auto flex items-center gap-2">
          <Select
            className="w-32"
            value={workflow.status}
            onChange={(e) => setWorkflow((wf) => ({ ...wf, status: e.target.value as WorkflowDef['status'] }))}
            aria-label="Automation status"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
          <Button variant="outline" size="sm" onClick={() => testRun.mutate()} loading={testRun.isPending}><Play /> Test run</Button>
          <Button size="sm" onClick={() => persist.mutate()} loading={persist.isPending}><Save /> Save</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Node library */}
        <aside className="w-60 shrink-0 space-y-4 overflow-y-auto border-r bg-card p-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
            <FormField label="When">
              {(id) => (
                <Select
                  id={id}
                  value={workflow.trigger.type}
                  onChange={(e) => setWorkflow((wf) => ({ ...wf, trigger: { ...wf.trigger, type: e.target.value as never } }))}
                >
                  {WORKFLOW_TRIGGERS.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Data table">
              {(id) => (
                <Select
                  id={id}
                  value={workflow.trigger.entityKey ?? ''}
                  onChange={(e) => setWorkflow((wf) => ({ ...wf, trigger: { ...wf.trigger, entityKey: e.target.value || undefined } }))}
                >
                  <option value="">Any</option>
                  {definition.entities.map((ent) => <option key={ent.id} value={ent.key}>{ent.pluralName}</option>)}
                </Select>
              )}
            </FormField>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add step</p>
            <div className="space-y-1">
              {WORKFLOW_NODE_TYPES.filter((t) => t !== 'trigger').map((type) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs font-medium hover:border-primary/40 hover:bg-accent/40"
                >
                  <Plus className="size-3.5 text-primary" /> {titleCase(type)}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Config + history */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l bg-card p-3">
          {selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{titleCase(selectedNode.type)}</p>
                {selectedNode.type !== 'trigger' && (
                  <Button variant="ghost" size="iconSm" aria-label="Remove step" onClick={() => removeNode(selectedNode.id)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                )}
              </div>
              <FormField label="Label">
                {(id) => (
                  <Input
                    id={id}
                    value={selectedNode.label ?? ''}
                    onChange={(e) =>
                      setWorkflow((wf) => ({
                        ...wf,
                        nodes: wf.nodes.map((n) => (n.id === selectedNode.id ? { ...n, label: e.target.value } : n)),
                      }))
                    }
                  />
                )}
              </FormField>
              <NodeConfigFields node={selectedNode} definition={definition} onChange={(patch) => updateNodeConfig(selectedNode.id, patch)} />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a step to configure it, or drag from a step's edge to connect it to another step.
              </p>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Execution history</p>
                <div className="space-y-2">
                  {workflowRuns.slice(0, 8).map((run) => (
                    <Card key={run.id} className="p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={run.status} />
                        <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleTimeString()}</span>
                      </div>
                      {run.error && <p className="mt-1 text-destructive">{run.error}</p>}
                      <p className="mt-1 text-muted-foreground">{run.steps.length} steps</p>
                    </Card>
                  ))}
                  {workflowRuns.length === 0 && <p className="text-xs text-muted-foreground">No runs yet. Use “Test run”.</p>}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function NodeConfigFields({
  node, definition, onChange,
}: {
  node: WorkflowNodeDef; definition: ApplicationDefinition;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const cfg = node.config;
  switch (node.type) {
    case 'create_notification':
      return (
        <>
          <FormField label="Title">{(id) => <Input id={id} value={String(cfg.title ?? '')} onChange={(e) => onChange({ title: e.target.value })} />}</FormField>
          <FormField label="Message" hint="Use {{field_key}} to insert record values.">
            {(id) => <Textarea id={id} rows={3} value={String(cfg.message ?? '')} onChange={(e) => onChange({ message: e.target.value })} />}
          </FormField>
        </>
      );
    case 'send_email':
      return (
        <>
          <FormField label="To">{(id) => <Input id={id} type="email" value={String(cfg.to ?? '')} onChange={(e) => onChange({ to: e.target.value })} />}</FormField>
          <FormField label="Subject">{(id) => <Input id={id} value={String(cfg.subject ?? '')} onChange={(e) => onChange({ subject: e.target.value })} />}</FormField>
          <FormField label="Body">{(id) => <Textarea id={id} rows={3} value={String(cfg.body ?? '')} onChange={(e) => onChange({ body: e.target.value })} />}</FormField>
        </>
      );
    case 'compare_field':
    case 'if_else':
      return (
        <>
          <FormField label="Field key">{(id) => <Input id={id} value={String(cfg.fieldKey ?? '')} onChange={(e) => onChange({ fieldKey: e.target.value })} />}</FormField>
          <FormField label="Operator">
            {(id) => (
              <Select id={id} value={String(cfg.operator ?? 'eq')} onChange={(e) => onChange({ operator: e.target.value })}>
                <option value="eq">Equals</option><option value="neq">Does not equal</option>
              </Select>
            )}
          </FormField>
          <FormField label="Value">{(id) => <Input id={id} value={String(cfg.value ?? '')} onChange={(e) => onChange({ value: e.target.value })} />}</FormField>
          <p className="text-xs text-muted-foreground">Connect the “true” and “false” branches by labelling edges in a future update; the first outgoing edge is used for “true”.</p>
        </>
      );
    case 'update_record':
    case 'change_status':
      return (
        <>
          <FormField label="Field key">{(id) => <Input id={id} value={String(cfg.fieldKey ?? (node.type === 'change_status' ? 'status' : ''))} onChange={(e) => onChange({ fieldKey: e.target.value })} />}</FormField>
          <FormField label="New value">{(id) => <Input id={id} value={String(cfg.value ?? '')} onChange={(e) => onChange({ value: e.target.value })} />}</FormField>
        </>
      );
    case 'create_record':
      return (
        <FormField label="Data table">
          {(id) => (
            <Select id={id} value={String(cfg.entityKey ?? '')} onChange={(e) => onChange({ entityKey: e.target.value })}>
              <option value="">Choose…</option>
              {definition.entities.map((ent) => <option key={ent.id} value={ent.key}>{ent.pluralName}</option>)}
            </Select>
          )}
        </FormField>
      );
    case 'add_audit_entry':
      return <FormField label="Summary">{(id) => <Input id={id} value={String(cfg.summary ?? '')} onChange={(e) => onChange({ summary: e.target.value })} />}</FormField>;
    case 'record_exists':
      return (
        <FormField label="Data table">
          {(id) => (
            <Select id={id} value={String(cfg.entityKey ?? '')} onChange={(e) => onChange({ entityKey: e.target.value })}>
              <option value="">Choose…</option>
              {definition.entities.map((ent) => <option key={ent.id} value={ent.key}>{ent.pluralName}</option>)}
            </Select>
          )}
        </FormField>
      );
    default:
      return <p className="text-xs text-muted-foreground">This step type has no extra configuration in this version.</p>;
  }
}
