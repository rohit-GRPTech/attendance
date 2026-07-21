import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Boxes, ChevronsUpDown, CircleHelp, Database, Hammer, LayoutDashboard,
  LayoutGrid, LogOut, Menu, Moon, ScrollText, Settings, ShoppingBag,
  ShoppingCart, Store, Sun, Users, Workflow, X, Search,
} from 'lucide-react';
import { branding } from '@appforge/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { cn, timeAgo } from '@/lib/utils';
import { Avatar, Badge } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { DropdownMenu, MenuItem, MenuSeparator } from '@/components/ui/overlays';

const navSections: Array<{ title?: string; items: Array<{ to: string; label: string; icon: typeof LayoutDashboard }> }> = [
  {
    items: [
      { to: routes.dashboard, label: 'Overview', icon: LayoutDashboard },
      { to: routes.applications, label: 'Applications', icon: LayoutGrid },
      { to: routes.data, label: 'Data', icon: Database },
      { to: routes.workflows, label: 'Automations', icon: Workflow },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { to: routes.users, label: 'Users & roles', icon: Users },
      { to: routes.auditLogs, label: 'Audit logs', icon: ScrollText },
      { to: routes.settings, label: 'Settings', icon: Settings },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { to: routes.marketplace, label: 'Browse templates', icon: Store },
      { to: routes.purchases, label: 'Purchases', icon: ShoppingCart },
      { to: routes.seller, label: 'Seller dashboard', icon: ShoppingBag },
    ],
  },
];

interface NotificationRow {
  id: string; title: string; body: string; kind: string; readAt: string | null; createdAt: string;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('appforge.theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('appforge.theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function DashboardLayout() {
  const { session, workspace, selectWorkspace, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle } = useDarkMode();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const notifications = useQuery({
    queryKey: ['notifications', workspace?.slug],
    queryFn: () => api.get<NotificationRow[]>('/notifications'),
    enabled: Boolean(workspace),
    refetchInterval: 60_000,
  });
  const unread = useMemo(
    () => (notifications.data?.data ?? []).filter((n) => !n.readAt).length,
    [notifications.data],
  );

  if (!session) return null;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Boxes className="size-5 text-primary" aria-hidden />
        <span className="font-semibold">{branding.productName}</span>
      </div>

      <div className="border-b p-3">
        <DropdownMenu
          align="start"
          trigger={
            <button className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="min-w-0">
                <span className="block truncate font-medium">{workspace?.name ?? 'Select workspace'}</span>
                <span className="block truncate text-xs text-muted-foreground capitalize">{workspace?.planId} plan</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          }
        >
          {session.workspaces.map((w) => (
            <MenuItem key={w.id} onClick={() => { selectWorkspace(w.slug); queryClient.clear(); }}>
              <span className="flex-1 truncate">{w.name}</span>
              {w.slug === workspace?.slug && <Badge tone="primary">Active</Badge>}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={() => navigate(routes.selectWorkspace)}>Manage workspaces</MenuItem>
        </DropdownMenu>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Main navigation">
        {navSections.map((section, i) => (
          <div key={i} className={cn(i > 0 && 'mt-5')}>
            {section.title && (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === routes.dashboard}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <a
          href="https://appforge.dev/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CircleHelp className="size-4" aria-hidden />
          Help & documentation
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/45" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 bg-card shadow-overlay animate-slide-up">
            <button
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-muted"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>

          <button
            className="hidden min-w-0 flex-1 max-w-sm items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted sm:flex"
            onClick={() => navigate(routes.applications)}
          >
            <Search className="size-4" aria-hidden />
            Search applications…
          </button>
          <div className="flex-1 sm:hidden" />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {dark ? <Sun /> : <Moon />}
            </Button>

            <DropdownMenu
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative">
                  <Bell />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Button>
              }
            >
              <div className="max-h-80 w-80 overflow-y-auto">
                {(notifications.data?.data ?? []).slice(0, 6).map((n) => (
                  <div key={n.id} className={cn('rounded-sm px-2.5 py-2 text-sm', !n.readAt && 'bg-accent/60')}>
                    <p className="font-medium">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                ))}
                {(notifications.data?.data ?? []).length === 0 && (
                  <p className="px-2.5 py-4 text-center text-sm text-muted-foreground">You're all caught up.</p>
                )}
              </div>
              <MenuSeparator />
              <MenuItem onClick={() => navigate(routes.notifications)}>View all notifications</MenuItem>
            </DropdownMenu>

            <DropdownMenu
              trigger={
                <button className="ml-1 flex items-center gap-2 rounded-full p-0.5 hover:bg-muted" aria-label="User menu">
                  <Avatar name={session.user.fullName} />
                </button>
              }
            >
              <div className="px-2.5 py-2">
                <p className="text-sm font-medium">{session.user.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
              </div>
              <MenuSeparator />
              <MenuItem onClick={() => navigate(routes.settings)}><Settings /> Settings</MenuItem>
              <MenuItem onClick={() => navigate(routes.billing)}><ShoppingBag /> Plans & billing</MenuItem>
              <MenuSeparator />
              <MenuItem danger onClick={() => { signOut(); navigate(routes.signIn); }}>
                <LogOut /> Sign out
              </MenuItem>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Small helper used by pages to render the builder shortcut consistently. */
export function BuilderLink({ appId }: { appId: string }) {
  const navigate = useNavigate();
  return (
    <Button variant="outline" size="sm" onClick={() => navigate(routes.builder(appId))}>
      <Hammer /> Open builder
    </Button>
  );
}
