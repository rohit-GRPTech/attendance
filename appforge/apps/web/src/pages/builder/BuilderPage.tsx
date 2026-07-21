import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, CloudOff, Database, Eye, FileStack, Loader2, Monitor,
  MoreHorizontal, Palette, Redo2, Rocket, Settings2, Shapes, Smartphone,
  Tablet, Undo2, Workflow as WorkflowIcon,
} from 'lucide-react';
import type { ApplicationDefinition, DefinitionIssue } from '@appforge/shared';
import { useApplication, usePublishApplication } from '@/features/applications/api';
import { useBuilderState, type BuilderState } from '@/features/builder/useBuilderState';
import { routes } from '@/routes';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Modal, PageSkeleton, ErrorState, StatusBadge } from '@/components/ui/surfaces';
import { DropdownMenu, MenuItem, useToast } from '@/components/ui/overlays';
import { BuilderCanvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { AppSettingsPanel, ComponentsPanel, DataPanel, PagesPanel, ThemePanel, WorkflowsPanel } from './panels';

const leftTabs = [
  { id: 'pages', label: 'Pages', icon: FileStack },
  { id: 'components', label: 'Components', icon: Shapes },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'workflows', label: 'Automations', icon: WorkflowIcon },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'settings', label: 'Settings', icon: Settings2 },
] as const;

export function BuilderPage() {
  const { appId = '' } = useParams();
  const app = useApplication(appId);

  if (app.isLoading) return <div className="p-6"><PageSkeleton /></div>;
  if (app.isError || !app.data) {
    return <div className="p-6"><ErrorState message="We could not load this application." onRetry={() => app.refetch()} /></div>;
  }
  return <BuilderInner appId={appId} key={appId} initialDefinition={app.data.data.definition} status={app.data.data.status} />;
}

function BuilderInner({ appId, initialDefinition, status }: { appId: string; initialDefinition: ApplicationDefinition; status: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const state = useBuilderState(appId, initialDefinition);
  const [activeTab, setActiveTab] = useState<(typeof leftTabs)[number]['id']>('pages');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [publishOpen, setPublishOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const page = useMemo(
    () => state.definition.pages.find((p) => p.id === state.selectedPageId) ?? state.definition.pages[0],
    [state.definition.pages, state.selectedPageId],
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ── Builder header ─────────────────────────────────────── */}
      <header className="flex h-13 shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="iconSm" onClick={() => navigate(routes.applications)} aria-label="Back to applications">
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{state.definition.app.name}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge status={status} />
            <SaveIndicator state={state} />
          </div>
        </div>

        <div className="mx-2 hidden items-center gap-0.5 md:flex">
          <Button variant="ghost" size="iconSm" onClick={state.undo} disabled={!state.canUndo} aria-label="Undo"><Undo2 /></Button>
          <Button variant="ghost" size="iconSm" onClick={state.redo} disabled={!state.canRedo} aria-label="Redo"><Redo2 /></Button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden rounded-md border p-0.5 sm:flex">
            {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([vp, Icon]) => (
              <Button
                key={vp}
                variant={viewport === vp ? 'secondary' : 'ghost'}
                size="iconSm"
                onClick={() => setViewport(vp)}
                aria-label={`${vp} preview`}
              >
                <Icon />
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(routes.preview(appId))}><Eye /> Preview</Button>
          <Button size="sm" onClick={() => setPublishOpen(true)}><Rocket /> Publish</Button>
          <DropdownMenu trigger={<Button variant="ghost" size="iconSm" aria-label="More actions"><MoreHorizontal /></Button>}>
            <MenuItem onClick={() => navigate(routes.appData(appId))}><Database /> Manage data</MenuItem>
            <MenuItem onClick={() => void state.saveNow().then((okSave) => okSave && toast.success('Draft saved.'))}>Save draft now</MenuItem>
            <MenuItem onClick={() => setLeftOpen((v) => !v)}>{leftOpen ? 'Hide' : 'Show'} left panel</MenuItem>
            <MenuItem onClick={() => setRightOpen((v) => !v)}>{rightOpen ? 'Hide' : 'Show'} properties</MenuItem>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {leftOpen && (
          <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
            <div className="flex border-b" role="tablist" aria-label="Builder panels">
              {leftTabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  title={tab.label}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors',
                    activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <tab.icon className="size-4" aria-hidden />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeTab === 'pages' && <PagesPanel state={state} />}
              {activeTab === 'components' && <ComponentsPanel state={state} />}
              {activeTab === 'data' && <DataPanel state={state} />}
              {activeTab === 'workflows' && <WorkflowsPanel state={state} appId={appId} />}
              {activeTab === 'theme' && <ThemePanel state={state} />}
              {activeTab === 'settings' && <AppSettingsPanel state={state} />}
            </div>
          </aside>
        )}

        {page ? (
          <BuilderCanvas state={state} page={page} viewport={viewport} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Add a page to start building.</div>
        )}

        {rightOpen && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l bg-card lg:block">
            <PropertiesPanel state={state} />
          </aside>
        )}
      </div>

      <PublishDialog appId={appId} open={publishOpen} onClose={() => setPublishOpen(false)} state={state} />
    </div>
  );
}

function SaveIndicator({ state }: { state: BuilderState }) {
  if (state.saveError) return <span className="inline-flex items-center gap-1 text-destructive"><CloudOff className="size-3" /> {state.saveError}</span>;
  if (state.saving) return <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Saving…</span>;
  if (state.dirty) return <span>Unsaved changes</span>;
  if (state.lastSavedAt) return <span className="inline-flex items-center gap-1"><Check className="size-3 text-success" /> Saved</span>;
  return <span>Autosave on</span>;
}

function PublishDialog({ appId, open, onClose, state }: { appId: string; open: boolean; onClose: () => void; state: BuilderState }) {
  const toast = useToast();
  const publish = usePublishApplication(appId);
  const [issues, setIssues] = useState<DefinitionIssue[] | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      await state.saveNow();
      const { data } = await api.post<{ valid: boolean; issues: DefinitionIssue[] }>(`/applications/${appId}/validate`);
      setIssues(data.issues);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed.');
    } finally {
      setChecking(false);
    }
  };

  const doPublish = () => {
    publish.mutate(undefined, {
      onSuccess: ({ data }) => {
        toast.success(`Published version ${data.version}. Your application is live.`);
        onClose();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Publishing failed.'),
    });
  };

  const errors = (issues ?? []).filter((i) => i.severity === 'error');
  const warnings = (issues ?? []).filter((i) => i.severity === 'warning');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publish changes"
      description="Publishing creates an immutable version and makes it live in the customer portal."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {issues === null ? (
            <Button onClick={check} loading={checking}>Run checks</Button>
          ) : (
            <Button onClick={doPublish} loading={publish.isPending} disabled={errors.length > 0}>
              <Rocket /> Publish now
            </Button>
          )}
        </>
      }
    >
      {issues === null ? (
        <p className="text-sm text-muted-foreground">
          We validate pages, navigation, data references, automations and permissions before anything goes live.
        </p>
      ) : errors.length > 0 ? (
        <Alert tone="danger" title={`${errors.length} issue${errors.length > 1 ? 's' : ''} must be fixed first`}>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
            {errors.slice(0, 8).map((issue, i) => <li key={i}><code>{issue.path}</code>: {issue.message}</li>)}
          </ul>
        </Alert>
      ) : (
        <div className="space-y-3">
          <Alert tone="success" title="All checks passed">Your application is ready to publish.</Alert>
          {warnings.length > 0 && (
            <Alert tone="warning" title={`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                {warnings.slice(0, 5).map((issue, i) => <li key={i}>{issue.message}</li>)}
              </ul>
            </Alert>
          )}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge>{state.definition.pages.length} pages</Badge>
            <Badge>{state.definition.entities.length} tables</Badge>
            <Badge>{state.definition.workflows.length} automations</Badge>
          </div>
        </div>
      )}
    </Modal>
  );
}
