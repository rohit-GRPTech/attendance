import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { routes } from '@/routes';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Compass className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to={routes.dashboard}><Button>Back to overview</Button></Link>
    </div>
  );
}
