import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Monitor, Rocket, Smartphone, Tablet } from 'lucide-react';
import { useApplication } from '@/features/applications/api';
import { routes } from '@/routes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, ErrorState, PageSkeleton } from '@/components/ui/surfaces';
import { DynamicIcon } from '@/components/ui/icon';
import { RuntimePage, type RuntimeContext } from '@/runtime/RuntimeRenderer';

/**
 * Preview: renders the DRAFT definition through the real runtime engine with
 * live workspace data, inside a viewport frame. What you see here is exactly
 * what publishes.
 */
export function PreviewPage() {
  const { appId = '' } = useParams();
  const navigate = useNavigate();
  const app = useApplication(appId);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [pageId, setPageId] = useState<string | null>(null);

  const definition = app.data?.data.definition;
  const activePage = useMemo(() => {
    if (!definition) return null;
    return definition.pages.find((p) => p.id === pageId) ?? definition.pages.find((p) => p.isHome) ?? definition.pages[0] ?? null;
  }, [definition, pageId]);

  if (app.isLoading) return <div className="p-6"><PageSkeleton /></div>;
  if (app.isError || !definition) return <div className="p-6"><ErrorState message="We could not load the preview." onRetry={() => app.refetch()} /></div>;

  const ctx: RuntimeContext = { appId, definition, navigateToPage: setPageId };
  const widths = { desktop: 'max-w-6xl', tablet: 'max-w-[768px]', mobile: 'max-w-[390px]' };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="flex h-13 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="iconSm" onClick={() => navigate(routes.builder(appId))} aria-label="Back to builder"><ArrowLeft /></Button>
        <p className="text-sm font-semibold">{definition.app.name}</p>
        <Badge tone="warning">Preview — draft version</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden rounded-md border p-0.5 sm:flex">
            {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([vp, Icon]) => (
              <Button key={vp} variant={viewport === vp ? 'secondary' : 'ghost'} size="iconSm" onClick={() => setViewport(vp)} aria-label={`${vp} viewport`}>
                <Icon />
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={() => navigate(routes.builder(appId))}><Rocket /> Back to publish</Button>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-6">
        <div className={cn('mx-auto overflow-hidden rounded-lg border bg-background shadow-card transition-all', widths[viewport])}>
          {/* In-app navigation preview */}
          <div className="flex items-center gap-1 overflow-x-auto border-b bg-card px-3 py-2">
            <DynamicIcon name={definition.app.icon} className="mr-1 size-4 text-primary" />
            {definition.navigation
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((nav) => (
                <button
                  key={nav.id}
                  onClick={() => setPageId(nav.pageId)}
                  className={cn(
                    'whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium',
                    activePage?.id === nav.pageId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {nav.label}
                </button>
              ))}
          </div>
          <div className="p-4 sm:p-6">
            {activePage ? <RuntimePage ctx={ctx} page={activePage} /> : <p className="text-sm text-muted-foreground">This application has no pages.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
