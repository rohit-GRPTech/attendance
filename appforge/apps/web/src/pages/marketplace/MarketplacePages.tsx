import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, ShoppingBag, ShoppingCart, Star, Store, Upload } from 'lucide-react';
import { BUSINESS_CATEGORIES } from '@appforge/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { useApplications } from '@/features/applications/api';
import { Button } from '@/components/ui/button';
import { FormField, Input, SearchInput, Select, Textarea } from '@/components/ui/input';
import { Badge, Card, EmptyState, ErrorState, Modal, PageSkeleton, StatusBadge } from '@/components/ui/surfaces';
import { Breadcrumbs, useToast } from '@/components/ui/overlays';
import { DataTable } from '@/components/ui/data-table';

interface TemplateCard {
  id: string; name: string; slug: string; shortDescription: string; category: string;
  creatorName: string; priceUsd: number; featured: boolean; installCount: number;
  rating: number; reviewCount: number; version: string; status: string; updatedAt: string;
}

interface TemplateDetail extends TemplateCard {
  longDescription: string;
  contents: {
    entities: Array<{ key: string; name: string; fieldCount: number }>;
    pages: Array<{ slug: string; name: string; type: string }>;
    workflows: Array<{ id: string; name: string }>;
    roles: Array<{ id: string; name: string }>;
  };
}

function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className="size-3.5 fill-warning text-warning" aria-hidden />
      <span className="font-medium">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
    </span>
  );
}

// ── Browse ───────────────────────────────────────────────────────
export function MarketplacePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const query = useQuery({
    queryKey: ['marketplace', search, category],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (category) qs.set('category', category);
      return api.get<TemplateCard[]>(`/marketplace/templates${qs.toString() ? `?${qs}` : ''}`);
    },
  });

  const rows = query.data?.data ?? [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Install ready-made business systems built by the AppForge community.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SearchInput placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" aria-label="Search templates" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-48" aria-label="Filter by category">
          <option value="">All categories</option>
          {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
        </Select>
      </div>

      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState message="We could not load the marketplace." onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Store />} title="No templates found" description="Try a different search or category." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 text-3xl font-semibold text-primary/60">
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.featured && <Badge tone="warning">Featured</Badge>}
                </div>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{t.shortDescription}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge>{titleCase(t.category)}</Badge>
                  <Rating value={t.rating} count={t.reviewCount} />
                  <span>{t.installCount} installs</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="font-semibold">{t.priceUsd > 0 ? formatCurrency(t.priceUsd) : <Badge tone="success">Free</Badge>}</span>
                  <Button size="sm" variant="outline" onClick={() => navigate(routes.template(t.id))}>View details</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Template details + install ───────────────────────────────────
export function TemplateDetailPage() {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [installOpen, setInstallOpen] = useState(false);
  const [appName, setAppName] = useState('');

  const query = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => api.get<TemplateDetail>(`/marketplace/templates/${templateId}`),
  });

  const install = useMutation({
    mutationFn: () => api.post<{ applicationId: string }>(`/marketplace/templates/${templateId}/install`, { applicationName: appName || undefined }),
    onSuccess: ({ data }) => {
      void queryClient.invalidateQueries();
      toast.success('Template installed — opening the builder.');
      navigate(routes.builder(data.applicationId));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Installation failed.'),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <ErrorState message="We could not load this template." onRetry={() => query.refetch()} />;
  const t = query.data.data;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Marketplace', onClick: () => navigate(routes.marketplace) }, { label: t.name }]} />

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{t.name}</h1>
                {t.featured && <Badge tone="warning">Featured</Badge>}
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t.shortDescription}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <Badge>{titleCase(t.category)}</Badge>
                <Rating value={t.rating} count={t.reviewCount} />
                <span className="text-muted-foreground">{t.installCount} installs</span>
                <span className="text-muted-foreground">v{t.version}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{t.priceUsd > 0 ? formatCurrency(t.priceUsd) : 'Free'}</p>
              <Button className="mt-2" onClick={() => setInstallOpen(true)}>
                <Download /> {t.priceUsd > 0 ? 'Purchase & install' : 'Install template'}
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-semibold">About this template</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.longDescription || t.shortDescription}</p>
            <h3 className="mt-6 font-semibold">What's included</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Data tables</p>
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                  {t.contents.entities.map((e) => <li key={e.key}>• {e.name} ({e.fieldCount} fields)</li>)}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">Pages</p>
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                  {t.contents.pages.map((p) => <li key={p.slug}>• {p.name}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">Automations</p>
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                  {t.contents.workflows.map((w) => <li key={w.id}>• {w.name}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">Roles</p>
                <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                  {t.contents.roles.map((r) => <li key={r.id}>• {r.name}</li>)}
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Card className="p-4">
              <p className="text-sm font-medium">Created by</p>
              <p className="mt-1 text-sm">{t.creatorName}</p>
              <p className="mt-3 text-sm font-medium">Last updated</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDate(t.updatedAt)}</p>
              <p className="mt-3 text-sm font-medium">Requirements</p>
              <p className="mt-1 text-sm text-muted-foreground">Any AppForge workspace. Paid templates use your workspace billing.</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium">Templates never include live data</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You get the structure — pages, tables, automations and roles. Your records stay private to your workspace.
              </p>
            </Card>
          </div>
        </div>
      </Card>

      <Modal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        title={`Install ${t.name}`}
        description="A copy of this template becomes a new application owned by your workspace."
        footer={
          <>
            <Button variant="outline" onClick={() => setInstallOpen(false)}>Cancel</Button>
            <Button onClick={() => install.mutate()} loading={install.isPending}>
              {t.priceUsd > 0 ? `Confirm purchase (${formatCurrency(t.priceUsd)})` : 'Install now'}
            </Button>
          </>
        }
      >
        <FormField label="Application name" hint="You can rename it later.">
          {(id) => <Input id={id} value={appName} onChange={(e) => setAppName(e.target.value)} placeholder={t.name} />}
        </FormField>
      </Modal>
    </div>
  );
}

// ── Purchases ────────────────────────────────────────────────────
interface PurchaseRow {
  id: string; templateName: string; pricePaidUsd: number; createdAt: string; installedApplicationId: string | null;
}

export function PurchasesPage() {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['purchases', workspace?.slug],
    queryFn: () => api.get<PurchaseRow[]>('/marketplace/purchases'),
    enabled: Boolean(workspace),
  });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message="We could not load purchases." onRetry={() => query.refetch()} />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Purchases</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Templates installed in this workspace.</p>
      </div>
      <DataTable
        columns={[
          { key: 'templateName', header: 'Template', render: (r) => <span className="font-medium">{r.templateName}</span> },
          { key: 'pricePaidUsd', header: 'Price paid', render: (r) => (r.pricePaidUsd > 0 ? formatCurrency(r.pricePaidUsd) : 'Free') },
          { key: 'createdAt', header: 'Installed', render: (r) => formatDate(r.createdAt) },
          {
            key: 'installedApplicationId', header: 'Application',
            render: (r) =>
              r.installedApplicationId
                ? <Button size="sm" variant="outline" onClick={() => navigate(routes.builder(r.installedApplicationId!))}>Open builder</Button>
                : '—',
          },
        ]}
        rows={query.data?.data ?? []}
        empty={<EmptyState icon={<ShoppingCart />} title="No purchases yet" description="Installed marketplace templates will appear here." action={<Button onClick={() => navigate(routes.marketplace)}>Browse marketplace</Button>} />}
      />
    </div>
  );
}

// ── Seller dashboard ─────────────────────────────────────────────
interface SellerOverview {
  templates: TemplateCard[];
  totalTemplates: number;
  publishedTemplates: number;
  pendingReview: number;
  totalInstalls: number;
  estimatedRevenueUsd: number;
}

export function SellerDashboardPage() {
  const { workspace } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [price, setPrice] = useState('0');

  const apps = useApplications();
  const query = useQuery({
    queryKey: ['seller', workspace?.slug],
    queryFn: () => api.get<SellerOverview>('/marketplace/seller/overview'),
    enabled: Boolean(workspace),
  });

  const publish = useMutation({
    mutationFn: () =>
      api.post('/marketplace/seller/templates', {
        applicationId, name, shortDescription, longDescription, priceUsd: Number(price) || 0,
      }),
    onSuccess: () => {
      toast.success('Template submitted for review.');
      setPublishOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['seller'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not submit the template.'),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message="We could not load your seller dashboard." onRetry={() => query.refetch()} />;
  const data = query.data!.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Seller dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Publish your applications as templates and track their performance.</p>
        </div>
        <Button onClick={() => setPublishOpen(true)}><Upload /> Create template</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Templates', data.totalTemplates],
          ['Published', data.publishedTemplates],
          ['Total installs', data.totalInstalls],
          ['Est. revenue', formatCurrency(data.estimatedRevenueUsd)],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Template', render: (t) => <span className="font-medium">{t.name}</span> },
          { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
          { key: 'priceUsd', header: 'Price', render: (t) => (t.priceUsd > 0 ? formatCurrency(t.priceUsd) : 'Free') },
          { key: 'installCount', header: 'Installs' },
          { key: 'rating', header: 'Rating', render: (t) => (t.reviewCount > 0 ? <Rating value={t.rating} count={t.reviewCount} /> : '—') },
          { key: 'updatedAt', header: 'Updated', render: (t) => formatDate(t.updatedAt) },
        ]}
        rows={data.templates}
        empty={<EmptyState icon={<ShoppingBag />} title="No templates yet" description="Turn one of your applications into a marketplace template." action={<Button onClick={() => setPublishOpen(true)}><Upload /> Create template</Button>} />}
      />

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Create a marketplace template"
        description="Only the structure is shared — pages, data tables, automations and roles. Never your records."
        footer={
          <>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button
              onClick={() => publish.mutate()}
              loading={publish.isPending}
              disabled={!applicationId || name.trim().length < 2 || shortDescription.trim().length < 10}
            >
              Submit for review
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Source application" required>
            {(id) => (
              <Select id={id} value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
                <option value="">Choose an application…</option>
                {(apps.data?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Template name" required>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Short description" required hint="Shown on the marketplace card (10–300 characters).">
            {(id) => <Input id={id} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />}
          </FormField>
          <FormField label="Full description">
            {(id) => <Textarea id={id} value={longDescription} onChange={(e) => setLongDescription(e.target.value)} />}
          </FormField>
          <FormField label="Price (USD)" hint="0 makes the template free.">
            {(id) => <Input id={id} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />}
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
