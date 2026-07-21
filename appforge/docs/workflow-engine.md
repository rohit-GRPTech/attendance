# Workflow engine

Workflows ("Automations" in user-facing copy) are declarative node graphs stored inside the
application definition and executed **server-side only** by
`apps/api/src/services/workflow-engine.ts`.

## Model

```ts
WorkflowDef {
  id, name, status: 'draft' | 'active' | 'disabled',
  trigger: { type, entityKey?, schedule? },
  nodes: [{ id, type, label?, config: JSON, position }],
  edges: [{ id, sourceNodeId, targetNodeId, branch? }]
}
```

Triggers: `record_created`, `record_updated`, `record_deleted`, `form_submitted`,
`button_clicked`, `schedule`, `webhook_received`, `user_invited`, `application_installed`.

Node types: trigger; conditions (`if_else`, `compare_field`, `record_exists`, `user_has_role`,
`date_condition`, `and_group`, `or_group`); actions (`create_record`, `update_record`,
`delete_record`, `send_email`, `create_notification`, `send_webhook`, `assign_user`,
`change_status`, `add_audit_entry`, `delay`, `approval_request`). Placeholder node types are
executed as recorded "skipped" steps so behaviour is always visible in run history.

## Execution

- Dispatched from the records service after create/update/delete, and from
  `POST /workflows/applications/:appId/workflows/:id/run` for button/test runs.
- Only `active` workflows run (test runs target a specific id).
- Traversal is breadth-first from the trigger node; condition nodes route on the `true`/`false`
  branch (edge `branch` label, defaulting to the first edge).
- **Safety**: publish validation rejects cycles and enforces `WORKFLOW_MAX_NODES`; the engine
  additionally hard-caps executed steps; node configs are declarative JSON — no user code is
  ever evaluated (strict rule #16); message templates support only `{{field_key}}` text
  interpolation.
- Every run writes a `workflow_runs` row (status, per-step results, error) and an audit entry.
  Failures never break the originating API request.

## Editor

`apps/web/src/pages/builder/WorkflowEditorPage.tsx` — React Flow canvas with a node library,
drag-positioning, edge connection, per-node configuration panel, draft/active toggle, test-run
button and execution history.
