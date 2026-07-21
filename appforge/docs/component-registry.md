# Component registry

`packages/shared/src/registry/component-registry.ts` is the single source of truth for which
components may appear in an application definition. It is framework-free metadata; the web app
supplies the renderers.

## Descriptor shape

```ts
interface ComponentDescriptor {
  type: string;                 // stable identifier stored in definitions
  label: string;                // builder display name
  category: 'layout' | 'data' | 'form' | 'content' | 'chart' | 'action';
  icon: string;                 // lucide icon name
  description: string;
  propsSchema: ZodType;         // validates the props object
  defaultProps: Record<string, unknown>;
  acceptsChildren: boolean;     // layout composition
  bindsField: boolean;          // form inputs bound to entity fields
  usesDataSource: boolean;      // reads an entity data source
  supportedActions: string[];   // which ComponentAction types it may carry
}
```

Registered types (28): layout — container, section, columns, stack, card, divider, spacer, tabs;
data — data_table, record_list, stat_card, detail_view, kanban; forms — form, text_input,
textarea, number_input, select_input, checkbox_input, date_input, relation_input; content —
heading, paragraph, alert, image; charts — bar_chart, pie_chart, line_chart; actions — button.

## Renderers

- **Builder preview** (`apps/web/src/pages/builder/Canvas.tsx` → `BuilderPreview`): static,
  data-free structural representation with selection outlines and data-binding badges.
- **Runtime renderer** (`apps/web/src/runtime/RuntimeRenderer.tsx` → `RuntimeComponent`):
  fetches permitted records, renders live tables/forms/charts/kanban and executes declared
  actions (navigate, run workflow, CRUD modals).

Both dispatch purely on `type`; there is no escape hatch that evaluates user-supplied code, and
the API rejects any definition containing an unregistered type
(`validateWithRegistry` in `apps/api/src/services/definition-service.ts`).

## Adding a component

1. Add a descriptor to `componentDescriptors` (type, props schema, defaults).
2. Add a case to `BuilderPreview` (static preview).
3. Add a case to `RuntimeComponent` (live renderer).
4. Done — it appears in the builder's Components tab automatically and validates end-to-end.
