import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Boxes, LayoutGrid, Menu, X } from 'lucide-react';
import { branding, type ApplicationDefinition } from '@appforge/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { cn, timeAgo, titleCase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, EmptyState, ErrorState, PageSkeleton } from '@/components/ui/surfaces';
import { Breadcrumbs } from '@/components/ui/overlays';
import { DynamicIcon } from '@/components/ui/icon';
import { RuntimePage, type RuntimeContext } from '@/runtime/RuntimeRenderer';

interface PortalApp {
  id: string; name: string; slug: string; description: string; icon: string; category: string; updatedAt: string; role: string;
}

interface PortalResolution {
  applicationId: string;
  definition: ApplicationDefinition;
  permissions: { allowedPageIds: string[]; isBuilder: boolean; appRole: { name: string } | null };
}

/** Portal home: the business user's installed applications. */
export function PortalHomePage() {
  const { tenantSlug = '' } = useParams();
  const { session, workspace, selectWorkspace, signOut } = useAuth();
  const navigate = useNavigate();

  // Keep the active workspace aligned with the URL (membership is verified server-side).
  useEffect(() => {
    if (session && tenantSlug && workspace?.slug !== tenantSlug && session.workspaces.some((w) => w.slug === tenantSlug)) {
      selectWorkspace(tenantSlug);
    }
  }, [session, tenantSlug, workspace, selectWorkspace]);

  const apps = useQuery({
    queryKey: ['portal-apps', tenantSlug],
    queryFn: () => api.get<PortalApp[]>('/portal/applications'),
    enabled: Boolean(session && workspace?.slug === tenantSlug),
  });

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          title="Sign in required"
          description="Sign in to access this workspace portal."
          action={<Link to={routes.signIn}><Button>Sign in</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Boxes className="size-5 text-primary" aria-hidden />
          {workspace?.name ?? branding.productName}
          <Badge tone="primary">Portal</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:block">{session.user.fullName}</span>
          <Avatar name={session.user.fullName} />
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate(routes.signIn); }}>Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold">Your applications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Everything your team has published for {workspace?.name}.</p>
        </div>
        {apps.isLoading ? (
          <PageSkeleton />
        ) : apps.isError ? (
          <ErrorState message="We could not load your applications." onRetry={() => apps.refetch()} />
        ) : (apps.data?.data ?? []).length === 0 ? (
          <EmptyState
            icon={<LayoutGrid />}
            title="No published applications yet"
            description="Once your team publishes an application, it will appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(apps.data?.data ?? []).map((app) => (
              <Card key={app.id} className="flex flex-col p-5">
                <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <DynamicIcon name={app.icon} className="size-5" />
                </span>
                <h3 className="mt-3 font-semibold">{app.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{app.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{titleCase(app.role)} · updated {timeAgo(app.updatedAt)}</span>
                </div>
                <Button className="mt-3" onClick={() => navigate(routes.portalApp(tenantSlug, app.slug))}>
                  Open application
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** Runtime shell for one published application. */
export function PortalAppPage() {
  const { tenantSlug = '', appSlug = '', pageSlug } = useParams();
  const { session, workspace, selectWorkspace } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (session && tenantSlug && workspace?.slug !== tenantSlug && session.workspaces.some((w) => w.slug === tenantSlug)) {
      selectWorkspace(tenantSlug);
    }
  }, [session, tenantSlug, workspace, selectWorkspace]);

  const resolution = useQuery({
    queryKey: ['portal-app', tenantSlug, appSlug],
    queryFn: () => api.get<PortalResolution>(`/portal/applications/${appSlug}`),
    enabled: Boolean(session && workspace?.slug === tenantSlug),
  });

  const data = resolution.data?.data;
  const definition = data?.definition;

  const activePage = useMemo(() => {
    if (!definition) return null;
    if (pageSlug) return definition.pages.find((p) => p.slug === pageSlug) ?? null;
    return definition.pages.find((p) => p.isHome) ?? definition.pages[0] ?? null;
  }, [definition, pageSlug]);

  useEffect(() => setMobileNavOpen(false), [pageSlug]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState title="Sign in required" action={<Link to={routes.signIn}><Button>Sign in</Button></Link>} />
      </div>
    );
  }
  if (resolution.isLoading || !workspace) return <div className="p-6"><PageSkeleton /></div>;
  if (resolution.isError || !definition) {
    return (
      <div className="p-6">
        <ErrorState message="This application is not available. It may not be published, or you may not have access." />
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => navigate(routes.portal(tenantSlug))}><ArrowLeft /> Back to portal</Button>
        </div>
      </div>
    );
  }

  const allowed = new Set(data!.permissions.allowedPageIds);
  const navItems = definition.navigation.slice().sort((a, b) => a.order - b.order).filter((n) => allowed.has(n.pageId));
  const pageAllowed = activePage && (allowed.has(activePage.id) || data!.permissions.isBuilder);
  const ctx: RuntimeContext = {
    appId: data!.applicationId,
    definition,
    navigateToPage: (pageId) => {
      const target = definition.pages.find((p) => p.id === pageId);
      if (target) navigate(routes.portalPage(tenantSlug, appSlug, target.slug));
    },
  };

  const nav = (
    <nav className="space-y-0.5 p-3" aria-label="Application navigation">
      {navItems.map((item) => {
        const page = definition.pages.find((p) => p.id === item.pageId);
        const active = activePage?.id === item.pageId;
        return (
          <button
            key={item.id}
            onClick={() => page && navigate(routes.portalPage(tenantSlug, appSlug, page.slug))}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <DynamicIcon name={item.icon ?? page?.icon} className="size-4 shrink-0" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-card lg:block">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <DynamicIcon name={definition.app.icon} className="size-5 text-primary" />
          <span className="truncate font-semibold">{definition.app.name}</span>
        </div>
        {nav}
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => navigate(routes.portal(tenantSlug))}>
            <ArrowLeft /> All applications
          </Button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/45" onClick={() => setMobileNavOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-64 bg-card shadow-overlay">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-semibold">{definition.app.name}</span>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X className="size-5" /></button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Breadcrumbs
            items={[
              { label: workspace.name, onClick: () => navigate(routes.portal(tenantSlug)) },
              { label: definition.app.name, onClick: () => navigate(routes.portalApp(tenantSlug, appSlug)) },
              ...(activePage ? [{ label: activePage.name }] : []),
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <Avatar name={session.user.fullName} size="sm" />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {!activePage ? (
            <EmptyState title="Page not found" description="This page does not exist in the application." />
          ) : !pageAllowed ? (
            <EmptyState title="No access" description="Your role does not include access to this page." />
          ) : (
            <RuntimePage ctx={ctx} page={activePage} />
          )}
        </main>
      </div>
    </div>
  );
}
