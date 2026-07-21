import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, FileJson, LayoutTemplate, PencilRuler, Sparkles, Upload } from 'lucide-react';
import { BUSINESS_CATEGORIES, type BusinessCategory } from '@appforge/shared';
import { api } from '@/lib/api';
import { routes } from '@/routes';
import { cn, titleCase } from '@/lib/utils';
import { useInvalidateApplications } from '@/features/applications/api';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select, Textarea, Checkbox } from '@/components/ui/input';
import { Alert, Card } from '@/components/ui/surfaces';
import { useToast, Breadcrumbs } from '@/components/ui/overlays';

type Method = 'blank' | 'ai' | 'template' | 'import';

interface TemplateOption {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  priceUsd: number;
}

const steps = ['Method', 'Details', 'Category', 'Starter', 'Modules', 'Review'] as const;

const moduleOptions = [
  'Dashboard overview', 'Record lists and detail pages', 'Data entry forms',
  'Team notifications', 'CSV import and export', 'Audit history',
];

export function NewApplicationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateApplications();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<Method>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('crm');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [importedJson, setImportedJson] = useState<unknown | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([...moduleOptions.slice(0, 3)]);

  const templates = useQuery({
    queryKey: ['marketplace-templates'],
    queryFn: () => api.get<TemplateOption[]>('/marketplace/templates'),
    enabled: method === 'template',
  });

  const create = useMutation({
    mutationFn: async () => {
      if (method === 'template' && templateId) {
        const { data } = await api.post<{ applicationId: string }>(`/marketplace/templates/${templateId}/install`, {
          applicationName: name,
        });
        return data.applicationId;
      }
      const { data } = await api.post<{ id: string }>('/applications', {
        name,
        description,
        category,
        ...(method === 'import' && importedJson ? { definition: importedJson } : {}),
      });
      return data.id;
    },
    onSuccess: (appId) => {
      invalidate();
      toast.success(`"${name}" was created.`);
      navigate(routes.builder(appId));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create the application.'),
  });

  const slug = useMemo(() => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), [name]);

  const canContinue = () => {
    if (step === 0) return true;
    if (step === 1) return name.trim().length >= 2;
    if (step === 3 && method === 'template') return Boolean(templateId);
    if (step === 3 && method === 'import') return Boolean(importedJson);
    return true;
  };

  const next = () => {
    if (step === 0 && method === 'ai') {
      navigate(routes.aiGenerator);
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const onImportFile = async (file: File) => {
    setImportError(null);
    try {
      const parsed = JSON.parse(await file.text());
      setImportedJson(parsed);
    } catch {
      setImportedJson(null);
      setImportError('That file is not valid JSON.');
    }
  };

  const methodCards: Array<{ id: Method; icon: typeof PencilRuler; title: string; text: string }> = [
    { id: 'blank', icon: PencilRuler, title: 'Start blank', text: 'Begin with an empty application and build every page yourself.' },
    { id: 'ai', icon: Sparkles, title: 'Generate with AI', text: 'Describe your business system and let AI draft the structure.' },
    { id: 'template', icon: LayoutTemplate, title: 'Use a template', text: 'Install a ready-made system from the marketplace.' },
    { id: 'import', icon: FileJson, title: 'Import JSON', text: 'Import an exported AppForge application definition.' },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumbs items={[{ label: 'Applications', onClick: () => navigate(routes.applications) }, { label: 'New application' }]} />
      <div>
        <h1 className="text-2xl font-semibold">Create an application</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">A short guided setup — you can change everything later in the builder.</p>
      </div>

      <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                i < step ? 'bg-success text-success-foreground' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('text-sm', i === step ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
            {i < steps.length - 1 && <span className="hidden h-px w-6 bg-border sm:block" aria-hidden />}
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {methodCards.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
                  method === m.id ? 'border-primary bg-accent/40 ring-1 ring-primary' : 'hover:border-primary/40',
                )}
                aria-pressed={method === m.id}
              >
                <m.icon className="size-5 text-primary" aria-hidden />
                <span className="font-medium">{m.title}</span>
                <span className="text-sm text-muted-foreground">{m.text}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <FormField label="Application name" required hint={slug ? `Web address: /portal/your-workspace/${slug}` : undefined}>
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Field Service Manager" />}
            </FormField>
            <FormField label="Description" hint="Shown on application cards and the customer portal.">
              {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Track jobs, technicians and invoices for our service team." />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Default language">{(id) => <Select id={id} defaultValue="en"><option value="en">English</option><option value="es">Spanish</option><option value="de">German</option></Select>}</FormField>
              <FormField label="Currency">{(id) => <Select id={id} defaultValue="USD"><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option></Select>}</FormField>
              <FormField label="Date format">{(id) => <Select id={id} defaultValue="MMM d, yyyy"><option>MMM d, yyyy</option><option>dd/MM/yyyy</option><option>MM/dd/yyyy</option></Select>}</FormField>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BUSINESS_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-md border px-3 py-2.5 text-sm font-medium transition-colors',
                  category === c ? 'border-primary bg-accent/40 ring-1 ring-primary' : 'hover:border-primary/40',
                )}
                aria-pressed={category === c}
              >
                {titleCase(c)}
              </button>
            ))}
          </div>
        )}

        {step === 3 && method === 'template' && (
          <div className="space-y-2">
            {templates.isLoading && <p className="text-sm text-muted-foreground">Loading templates…</p>}
            {(templates.data?.data ?? []).map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left',
                  templateId === t.id ? 'border-primary bg-accent/40 ring-1 ring-primary' : 'hover:border-primary/40',
                )}
              >
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-sm text-muted-foreground">{t.shortDescription}</span>
                </span>
                <span className="text-sm font-medium">{t.priceUsd > 0 ? `$${t.priceUsd}` : 'Free'}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && method === 'import' && (
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void onImportFile(e.target.files[0])}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              <Upload className="size-6" aria-hidden />
              {importedJson ? 'JSON file loaded — click to replace' : 'Click to choose an exported definition (.json)'}
            </button>
            {importError && <Alert tone="danger">{importError}</Alert>}
            {Boolean(importedJson) && <Alert tone="success">Definition loaded. It will be validated on creation.</Alert>}
          </div>
        )}

        {step === 3 && (method === 'blank' || method === 'ai') && (
          <Alert tone="info" title="No starter needed">
            You chose to start blank — a clean home page will be created for you.
          </Alert>
        )}

        {step === 4 && (
          <div className="space-y-2">
            <p className="mb-3 text-sm text-muted-foreground">Choose the modules to emphasise in your starter pages.</p>
            {moduleOptions.map((m) => (
              <div key={m}>
                <Checkbox
                  label={m}
                  checked={modules.includes(m)}
                  onChange={(v) => setModules((cur) => (v ? [...cur, m] : cur.filter((x) => x !== m)))}
                />
              </div>
            ))}
          </div>
        )}

        {step === 5 && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Creation method</dt><dd className="font-medium">{methodCards.find((m) => m.id === method)?.title}</dd></div>
            <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{name || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Category</dt><dd className="font-medium">{titleCase(category)}</dd></div>
            <div><dt className="text-muted-foreground">Modules</dt><dd className="font-medium">{modules.length} selected</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Description</dt><dd>{description || 'No description'}</dd></div>
          </dl>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => (step === 0 ? navigate(routes.applications) : setStep((s) => s - 1))}>
          <ArrowLeft /> {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={next} disabled={!canContinue()}>Continue <ArrowRight /></Button>
        ) : (
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={name.trim().length < 2}>
            Create application
          </Button>
        )}
      </div>
    </div>
  );
}
