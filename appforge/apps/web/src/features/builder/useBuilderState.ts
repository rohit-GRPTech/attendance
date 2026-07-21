import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApplicationDefinition, ComponentNode, EntityDef, PageDef, WorkflowDef } from '@appforge/shared';
import { getComponentDescriptor } from '@appforge/shared';
import { useSaveDefinition } from '@/features/applications/api';

function makeId(): string {
  return crypto.randomUUID();
}

export interface BuilderState {
  definition: ApplicationDefinition;
  selectedPageId: string | null;
  selectedComponentId: string | null;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;

  selectPage(pageId: string): void;
  selectComponent(componentId: string | null): void;
  undo(): void;
  redo(): void;
  saveNow(): Promise<boolean>;

  update(mutator: (def: ApplicationDefinition) => void): void;
  addComponent(pageId: string, type: string, index?: number): void;
  updateComponent(pageId: string, componentId: string, patch: Partial<ComponentNode>): void;
  removeComponent(pageId: string, componentId: string): void;
  duplicateComponent(pageId: string, componentId: string): void;
  moveComponent(pageId: string, fromIndex: number, toIndex: number): void;

  addPage(name: string, type: PageDef['type']): void;
  updatePage(pageId: string, patch: Partial<PageDef>): void;
  removePage(pageId: string): void;

  addEntity(name: string, pluralName: string): void;
  updateEntity(entityId: string, patch: Partial<EntityDef>): void;
  removeEntity(entityId: string): void;

  addWorkflow(name: string): string;
  updateWorkflow(workflowId: string, patch: Partial<WorkflowDef>): void;
  removeWorkflow(workflowId: string): void;
}

/**
 * Builder state: an in-memory working copy of the JSON definition with
 * undo/redo history and debounced autosave. Every mutation goes through
 * `update`, which snapshots history immutably.
 */
export function useBuilderState(appId: string, initial: ApplicationDefinition): BuilderState {
  const [definition, setDefinition] = useState<ApplicationDefinition>(initial);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    initial.pages.find((p) => p.isHome)?.id ?? initial.pages[0]?.id ?? null,
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const undoStack = useRef<ApplicationDefinition[]>([]);
  const redoStack = useRef<ApplicationDefinition[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const save = useSaveDefinition(appId);
  const latest = useRef(definition);
  latest.current = definition;

  const update = useCallback((mutator: (def: ApplicationDefinition) => void) => {
    setDefinition((current) => {
      undoStack.current.push(current);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      const draft: ApplicationDefinition = JSON.parse(JSON.stringify(current));
      mutator(draft);
      return draft;
    });
    setDirty(true);
    setSaveError(null);
    setHistoryVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(latest.current);
    setDefinition(prev);
    setDirty(true);
    setHistoryVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(latest.current);
    setDefinition(next);
    setDirty(true);
    setHistoryVersion((v) => v + 1);
  }, []);

  const saveNow = useCallback(async (): Promise<boolean> => {
    try {
      await save.mutateAsync(latest.current);
      setDirty(false);
      setLastSavedAt(new Date());
      setSaveError(null);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Autosave failed.');
      return false;
    }
  }, [save]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => void saveNow(), 1500);
    return () => clearTimeout(timer);
  }, [dirty, definition, saveNow]);

  // ── Component operations ───────────────────────────────────────
  const addComponent = useCallback(
    (pageId: string, type: string, index?: number) => {
      const descriptor = getComponentDescriptor(type);
      if (!descriptor) return;
      const node: ComponentNode = {
        id: makeId(),
        type,
        props: JSON.parse(JSON.stringify(descriptor.defaultProps)),
        ...(descriptor.acceptsChildren ? { children: [] } : {}),
      };
      update((def) => {
        const page = def.pages.find((p) => p.id === pageId);
        if (!page) return;
        if (descriptor.usesDataSource && page.dataSource) node.dataSource = { ...page.dataSource };
        else if (descriptor.usesDataSource && def.entities[0]) node.dataSource = { entityKey: def.entities[0].key };
        if (index === undefined) page.components.push(node);
        else page.components.splice(index, 0, node);
      });
      setSelectedComponentId(node.id);
    },
    [update],
  );

  const findAndMutate = (
    def: ApplicationDefinition,
    pageId: string,
    componentId: string,
    fn: (list: ComponentNode[], index: number) => void,
  ): boolean => {
    const page = def.pages.find((p) => p.id === pageId);
    if (!page) return false;
    const walk = (list: ComponentNode[]): boolean => {
      const idx = list.findIndex((c) => c.id === componentId);
      if (idx >= 0) {
        fn(list, idx);
        return true;
      }
      return list.some((c) => (c.children ? walk(c.children) : false));
    };
    return walk(page.components);
  };

  const updateComponent = useCallback(
    (pageId: string, componentId: string, patch: Partial<ComponentNode>) =>
      update((def) => {
        findAndMutate(def, pageId, componentId, (list, idx) => {
          list[idx] = { ...list[idx]!, ...patch, id: list[idx]!.id };
        });
      }),
    [update],
  );

  const removeComponent = useCallback(
    (pageId: string, componentId: string) => {
      update((def) => {
        findAndMutate(def, pageId, componentId, (list, idx) => list.splice(idx, 1));
      });
      setSelectedComponentId(null);
    },
    [update],
  );

  const duplicateComponent = useCallback(
    (pageId: string, componentId: string) =>
      update((def) => {
        findAndMutate(def, pageId, componentId, (list, idx) => {
          const clone: ComponentNode = JSON.parse(JSON.stringify(list[idx]));
          const reid = (node: ComponentNode) => {
            node.id = makeId();
            node.children?.forEach(reid);
          };
          reid(clone);
          list.splice(idx + 1, 0, clone);
        });
      }),
    [update],
  );

  const moveComponent = useCallback(
    (pageId: string, fromIndex: number, toIndex: number) =>
      update((def) => {
        const page = def.pages.find((p) => p.id === pageId);
        if (!page) return;
        const [moved] = page.components.splice(fromIndex, 1);
        if (moved) page.components.splice(toIndex, 0, moved);
      }),
    [update],
  );

  // ── Page operations ────────────────────────────────────────────
  const addPage = useCallback(
    (name: string, type: PageDef['type']) => {
      const id = makeId();
      update((def) => {
        const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
        let slug = slugBase;
        let n = 2;
        while (def.pages.some((p) => p.slug === slug)) slug = `${slugBase}-${n++}`;
        def.pages.push({
          id, name, slug, type, icon: 'file', showInNavigation: true, layout: 'single',
          components: [{ id: makeId(), type: 'heading', props: { text: name, level: 1 } }],
        });
        def.navigation.push({ id: makeId(), label: name, icon: 'file', pageId: id, order: def.navigation.length });
      });
      setSelectedPageId(id);
    },
    [update],
  );

  const updatePage = useCallback(
    (pageId: string, patch: Partial<PageDef>) =>
      update((def) => {
        const page = def.pages.find((p) => p.id === pageId);
        if (!page) return;
        Object.assign(page, patch, { id: page.id });
        if (patch.isHome) def.pages.forEach((p) => { if (p.id !== pageId) p.isHome = false; });
        if (patch.name) {
          const nav = def.navigation.find((n) => n.pageId === pageId);
          if (nav) nav.label = patch.name;
        }
      }),
    [update],
  );

  const removePage = useCallback(
    (pageId: string) => {
      update((def) => {
        def.pages = def.pages.filter((p) => p.id !== pageId);
        def.navigation = def.navigation.filter((n) => n.pageId !== pageId);
      });
      setSelectedPageId((cur) => (cur === pageId ? null : cur));
    },
    [update],
  );

  // ── Entity operations ──────────────────────────────────────────
  const addEntity = useCallback(
    (name: string, pluralName: string) => {
      update((def) => {
        const keyBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'entity';
        let key = keyBase;
        let n = 2;
        while (def.entities.some((e) => e.key === key)) key = `${keyBase}_${n++}`;
        const nameFieldId = makeId();
        def.entities.push({
          id: makeId(), key, name, pluralName, icon: 'database', displayFieldKey: 'name',
          timestamps: true, softDelete: true, auditTracking: true,
          fields: [
            { id: nameFieldId, key: 'name', label: 'Name', type: 'short_text', required: true },
            { id: makeId(), key: 'notes', label: 'Notes', type: 'long_text' },
          ],
        });
        for (const role of def.roles) {
          role.entityPermissions.push({ entityKey: key, create: true, read: true, update: true, delete: role.key === 'admin', recordScope: 'all' });
        }
      });
    },
    [update],
  );

  const updateEntity = useCallback(
    (entityId: string, patch: Partial<EntityDef>) =>
      update((def) => {
        const entity = def.entities.find((e) => e.id === entityId);
        if (entity) Object.assign(entity, patch, { id: entity.id, key: entity.key });
      }),
    [update],
  );

  const removeEntity = useCallback(
    (entityId: string) =>
      update((def) => {
        const entity = def.entities.find((e) => e.id === entityId);
        if (!entity) return;
        def.entities = def.entities.filter((e) => e.id !== entityId);
        for (const role of def.roles) {
          role.entityPermissions = role.entityPermissions.filter((p) => p.entityKey !== entity.key);
        }
      }),
    [update],
  );

  // ── Workflow operations ────────────────────────────────────────
  const addWorkflow = useCallback(
    (name: string): string => {
      const id = makeId();
      update((def) => {
        const triggerId = makeId();
        const actionId = makeId();
        def.workflows.push({
          id, name, status: 'draft',
          trigger: { type: 'record_created', entityKey: def.entities[0]?.key },
          nodes: [
            { id: triggerId, type: 'trigger', label: 'When a record is created', config: {}, position: { x: 120, y: 60 } },
            { id: actionId, type: 'create_notification', label: 'Notify team', config: { title: 'Update', message: 'A record was created.' }, position: { x: 120, y: 220 } },
          ],
          edges: [{ id: makeId(), sourceNodeId: triggerId, targetNodeId: actionId }],
        });
      });
      return id;
    },
    [update],
  );

  const updateWorkflow = useCallback(
    (workflowId: string, patch: Partial<WorkflowDef>) =>
      update((def) => {
        const wf = def.workflows.find((w) => w.id === workflowId);
        if (wf) Object.assign(wf, patch, { id: wf.id });
      }),
    [update],
  );

  const removeWorkflow = useCallback(
    (workflowId: string) =>
      update((def) => {
        def.workflows = def.workflows.filter((w) => w.id !== workflowId);
      }),
    [update],
  );

  return useMemo(
    () => ({
      definition,
      selectedPageId,
      selectedComponentId,
      dirty,
      saving: save.isPending,
      lastSavedAt,
      saveError,
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
      selectPage: (id: string) => { setSelectedPageId(id); setSelectedComponentId(null); },
      selectComponent: setSelectedComponentId,
      undo, redo, saveNow, update,
      addComponent, updateComponent, removeComponent, duplicateComponent, moveComponent,
      addPage, updatePage, removePage,
      addEntity, updateEntity, removeEntity,
      addWorkflow, updateWorkflow, removeWorkflow,
    }),
    // historyVersion keeps canUndo/canRedo fresh after ref mutations
    [
      definition, selectedPageId, selectedComponentId, dirty, save.isPending, lastSavedAt, saveError,
      historyVersion, undo, redo, saveNow, update, addComponent, updateComponent, removeComponent,
      duplicateComponent, moveComponent, addPage, updatePage, removePage, addEntity, updateEntity,
      removeEntity, addWorkflow, updateWorkflow, removeWorkflow,
    ],
  );
}
