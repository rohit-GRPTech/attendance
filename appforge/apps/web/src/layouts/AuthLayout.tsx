import { Outlet, Link } from 'react-router-dom';
import { branding } from '@appforge/shared';
import { Boxes, CheckCircle2 } from 'lucide-react';

const benefits = [
  'Visual builder for pages, forms and dashboards',
  'One-day launch for small business systems',
  'Roles, permissions and audit built in',
  'Marketplace templates to start faster',
];

/** Split-screen authentication layout: branding left, form card right. */
export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#151633] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(48rem 30rem at 18% 12%, rgba(99,102,241,0.45), transparent 60%), radial-gradient(40rem 28rem at 85% 90%, rgba(56,189,248,0.25), transparent 55%)',
          }}
        />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold">
            <Boxes className="size-6 text-indigo-300" aria-hidden />
            {branding.productName}
          </Link>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">{branding.tagline}</h1>
          <p className="mt-3 text-white/70">{branding.description}</p>
          <ul className="mt-8 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-white/85">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-indigo-300" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <figure className="relative max-w-md rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur">
          <blockquote className="text-sm text-white/85">
            “We replaced four spreadsheets and a legacy job tracker with one AppForge workspace. Our service team
            shipped its own system in an afternoon.”
          </blockquote>
          <figcaption className="mt-3 text-xs text-white/60">Maria Santos — Operations Lead, Brightpath Consulting</figcaption>
        </figure>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold">
              <Boxes className="size-6 text-primary" aria-hidden />
              {branding.productName}
            </Link>
          </div>
          <Outlet />
          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <a href="#terms" className="underline hover:text-foreground">Terms of Service</a> and{' '}
            <a href="#privacy" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
