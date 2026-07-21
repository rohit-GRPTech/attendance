import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Dropdown menu ────────────────────────────────────────────────
export function DropdownMenu({
  trigger, children, align = 'end',
}: {
  trigger: ReactNode; children: ReactNode; align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-40 mt-1 min-w-44 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-overlay animate-fade-in',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children, onClick, danger, disabled,
}: {
  children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors [&_svg]:size-4',
        danger ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-muted',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border" role="separator" />;
}

// ── Tabs ─────────────────────────────────────────────────────────
export function Tabs({
  tabs, value, onChange, className,
}: {
  tabs: Array<{ value: string; label: ReactNode }>;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto rounded-lg bg-muted p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Toasts ───────────────────────────────────────────────────────
interface Toast {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

const ToastContext = createContext<{ push: (tone: Toast['tone'], message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-md border bg-card p-3 text-sm shadow-overlay animate-slide-up',
              toast.tone === 'error' && 'border-destructive/40',
            )}
          >
            {toast.tone === 'success'
              ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              : <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
            <p className="flex-1">{toast.message}</p>
            <button
              onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))}
              aria-label="Dismiss notification"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return {
    success: (message: string) => ctx.push('success', message),
    error: (message: string) => ctx.push('error', message),
  };
}

// ── Breadcrumbs ──────────────────────────────────────────────────
export function Breadcrumbs({ items }: { items: Array<{ label: string; onClick?: () => void }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {item.onClick ? (
            <button onClick={item.onClick} className="hover:text-foreground hover:underline">{item.label}</button>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ── Pagination ───────────────────────────────────────────────────
export function Pagination({
  page, totalPages, onChange,
}: {
  page: number; totalPages: number; onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Pagination">
      <button
        className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-muted-foreground">Page {page} of {totalPages}</span>
      <button
        className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
