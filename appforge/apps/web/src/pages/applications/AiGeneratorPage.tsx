import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Bot, Check, Sparkles, Wand2 } from 'lucide-react';
import { BUSINESS_CATEGORIES, type ApplicationDefinition, type BusinessCategory, type DefinitionIssue } from '@appforge/shared';
import { api } from '@/lib/api';
import { routes } from '@/routes';
import { cn, titleCase } from '@/lib/utils';
import { useInvalidateApplications } from '@/features/applications/api';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select, Textarea, Checkbox } from '@/components/ui/input';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { useToast, Breadcrumbs } from '@/components/ui/overlays';
import { DynamicIcon } from '@/components/ui/icon';

interface GenerationResult {
  valid: boolean;
  definition: ApplicationDefinition | unknown;
  issues: DefinitionIssue[];
  provider: string;
  model: string;
}

const complexities = [
  { id: 'simple', title: 'Simple', text: 'A few core tables and pages — perfect for one process.' },
  { id: 'standard', title: 'Standard', text: 'Typical small business system with related tables and automations.' },
  { id: 'advanced', title: 'Advanced', text: 'Larger structure with more entities, roles and workflows.' },
] as const;

const moduleChoices = ['Dashboards', 'Forms', 'Automations', 'Roles & permissions', 'Sample records'];

export function AiGeneratorPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateApplications();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('custom');
  const [complexity, setComplexity] = useState<'simple' | 'standard' | 'advanced'>('standard');
  const [modules, setModules] = useState<string[]>(['Dashboards', 'Forms', 'Automations']);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const generate = useMutation({
    mutationFn: () =>
      api.post<GenerationResult>('/ai/generate', {
        name, description, category, complexity,
        includeSampleRecords: modules.includes('Sample records'),
      }),
    onSuccess: ({ data }) => setResult(data),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Generation failed.'),
  });

  const repair = useMutation({
    mutationFn: () =>
      api.post<GenerationResult>('/ai/repair', {
        definition: result?.definition,
        issues: (result?.issues ?? []).filter((i) => i.severity === 'error').map(({ path, message }) => ({ path, message })),
      }),
    onSuccess: ({ data }) => {
      setResult((prev) => (prev ? { ...prev, ...data } : null));
      toast.success(data.valid ? 'The definition now passes validation.' : 'Repair attempted — some issues remain.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Repair failed.'),
  });

  const accept = useMutation({
    mutationFn: async () => {
      const def = result?.definition as ApplicationDefinition;
      const { data } = await api.post<{ id: string }>('/applications', {
        name: def.app.name, description: def.app.description, category: def.app.category, icon: def.app.icon,
        definition: def,
      });
      return data.id;
    },
    onSuccess: (appId) => {
      invalidate();
      toast.success('Draft application saved.');
      navigate(routes.builder(appId));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save the application.'),
  });

  const validDef = result?.valid ? (result.definition as ApplicationDefinition) : null;
  const errors = (result?.issues ?? []).filter((i) => i.severity === 'error');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Breadcrumbs items={[{ label: 'Applications', onClick: () => navigate(routes.applications) }, { label: 'AI generator' }]} />
      <div className="flex items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Bot className="size-5" /></span>
        <div>
          <h1 className="text-2xl font-semibold">Generate an application with AI</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Describe the system you need. AI drafts the structure; every draft is validated before anything is saved.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="space-y-4 p-6">
          <FormField label="Application name" required>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vehicle Repair Manager" />}
          </FormField>
          <FormField label="Describe your business system" required hint="Mention the things you track — customers, jobs, invoices — and what should happen automatically.">
            {(id) => (
              <Textarea
                id={id}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Create a vehicle repair management system with customers, vehicles, job cards, services, invoices, payments, mechanics, and service reminders."
              />
            )}
          </FormField>
          <FormField label="Business category">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as BusinessCategory)}>
                {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </Select>
            )}
          </FormField>
          <div>
            <p className="mb-1.5 text-sm font-medium">Complexity</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {complexities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setComplexity(c.id)}
                  className={cn(
                    'rounded-md border p-3 text-left text-sm',
                    complexity === c.id ? 'border-primary bg-accent/40 ring-1 ring-primary' : 'hover:border-primary/40',
                  )}
                  aria-pressed={complexity === c.id}
                >
                  <span className="block font-medium">{c.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{c.text}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Required modules</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {moduleChoices.map((m) => (
                <Checkbox key={m} label={m} checked={modules.includes(m)} onChange={(v) => setModules((cur) => (v ? [...cur, m] : cur.filter((x) => x !== m)))} />
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => generate.mutate()}
            loading={generate.isPending}
            disabled={name.trim().length < 2 || description.trim().length < 10}
          >
            <Sparkles /> Generate draft
          </Button>
        </Card>

        <div className="space-y-4">
          {!result && !generate.isPending && (
            <Card className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
              <Wand2 className="size-8 text-primary/60" aria-hidden />
              Your generated structure will appear here — entities, pages, roles and automations, ready to preview before you accept.
            </Card>
          )}
          {generate.isPending && (
            <Card className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
              <Sparkles className="size-8 animate-pulse text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">Drafting your application…</p>
            </Card>
          )}
          {result && (
            <>
              {errors.length > 0 ? (
                <Alert tone="warning" title={`${errors.length} validation issue${errors.length > 1 ? 's' : ''} found`}>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                    {errors.slice(0, 5).map((issue, i) => <li key={i}><code>{issue.path}</code>: {issue.message}</li>)}
                  </ul>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => repair.mutate()} loading={repair.isPending}>
                    <Wand2 /> Ask AI to repair
                  </Button>
                </Alert>
              ) : (
                <Alert tone="success" title="Draft passed validation">
                  Generated by {result.provider} ({result.model}). Review the structure and accept to save it as a draft application.
                </Alert>
              )}

              {validDef && (
                <Card className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <DynamicIcon name={validDef.app.icon} className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{validDef.app.name}</h3>
                      <p className="text-sm text-muted-foreground">{titleCase(validDef.app.category)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div className="rounded-md bg-muted p-2.5 text-center"><p className="text-lg font-semibold">{validDef.entities.length}</p><p className="text-xs text-muted-foreground">Tables</p></div>
                    <div className="rounded-md bg-muted p-2.5 text-center"><p className="text-lg font-semibold">{validDef.pages.length}</p><p className="text-xs text-muted-foreground">Pages</p></div>
                    <div className="rounded-md bg-muted p-2.5 text-center"><p className="text-lg font-semibold">{validDef.workflows.length}</p><p className="text-xs text-muted-foreground">Automations</p></div>
                    <div className="rounded-md bg-muted p-2.5 text-center"><p className="text-lg font-semibold">{validDef.roles.length}</p><p className="text-xs text-muted-foreground">Roles</p></div>
                  </div>
                  <div className="mt-4">
                    <p className="mb-1.5 text-sm font-medium">Data tables</p>
                    <div className="flex flex-wrap gap-1.5">
                      {validDef.entities.map((e) => <Badge key={e.id} tone="primary">{e.pluralName}</Badge>)}
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-sm font-medium">Pages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {validDef.pages.map((p) => <Badge key={p.id}>{p.name}</Badge>)}
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button className="flex-1" onClick={() => accept.mutate()} loading={accept.isPending}>
                      <Check /> Accept & open builder
                    </Button>
                    <Button variant="outline" onClick={() => setResult(null)}>Start over</Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <Button variant="ghost" onClick={() => navigate(routes.applications)}><ArrowLeft /> Back to applications</Button>
    </div>
  );
}
