import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Clock, Github, Lock, MailCheck, ShieldOff } from 'lucide-react';
import { api, ApiRequestError, type Session } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { Button } from '@/components/ui/button';
import { FormField, Input, PasswordInput } from '@/components/ui/input';
import { Alert } from '@/components/ui/surfaces';

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function SocialPlaceholders() {
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled title="Coming soon"><Github /> GitHub</Button>
        <Button variant="outline" disabled title="Coming soon">Google</Button>
      </div>
    </>
  );
}

// ── Sign in ──────────────────────────────────────────────────────
const signInSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const session = await signIn(values.email, values.password);
      navigate(session.workspaces.length === 1 ? routes.dashboard : routes.selectWorkspace);
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : 'Unable to sign in right now.');
    }
  });

  return (
    <AuthCard
      title="Welcome back"
      subtitle={<>New here? <Link className="font-medium text-primary hover:underline" to={routes.register}>Create an account</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <FormField label="Email" required error={form.formState.errors.email?.message}>
          {(id) => <Input id={id} type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={!!form.formState.errors.email} {...form.register('email')} />}
        </FormField>
        <div>
          <FormField label="Password" required error={form.formState.errors.password?.message}>
            {(id) => <PasswordInput id={id} autoComplete="current-password" aria-invalid={!!form.formState.errors.password} {...form.register('password')} />}
          </FormField>
          <div className="mt-1.5 text-right">
            <Link to={routes.forgotPassword} className="text-sm text-primary hover:underline">Forgot password?</Link>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Sign in</Button>
      </form>
      <SocialPlaceholders />
      <p className="mt-5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Demo workspace: <strong>maria@brightpath.co</strong> / <strong>Demo1234!</strong>
      </p>
    </AuthCard>
  );
}

// ── Register ─────────────────────────────────────────────────────
const registerSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name'),
  workspaceName: z.string().min(2, 'Enter a workspace name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await registerAccount(values);
      navigate(routes.dashboard);
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : 'Unable to create your account right now.');
    }
  });

  return (
    <AuthCard
      title="Create your workspace"
      subtitle={<>Already have an account? <Link className="font-medium text-primary hover:underline" to={routes.signIn}>Sign in</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <FormField label="Full name" required error={form.formState.errors.fullName?.message}>
          {(id) => <Input id={id} autoComplete="name" placeholder="Jordan Smith" {...form.register('fullName')} />}
        </FormField>
        <FormField label="Workspace name" required error={form.formState.errors.workspaceName?.message} hint="Your company or team name — you can change it later.">
          {(id) => <Input id={id} placeholder="Acme Field Services" {...form.register('workspaceName')} />}
        </FormField>
        <FormField label="Work email" required error={form.formState.errors.email?.message}>
          {(id) => <Input id={id} type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />}
        </FormField>
        <FormField label="Password" required error={form.formState.errors.password?.message}>
          {(id) => <PasswordInput id={id} autoComplete="new-password" {...form.register('password')} />}
        </FormField>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Create account</Button>
      </form>
      <SocialPlaceholders />
    </AuthCard>
  );
}

// ── Forgot / reset password ──────────────────────────────────────
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email address') })) });
  const onSubmit = form.handleSubmit(async ({ email }) => {
    await api.post('/auth/forgot-password', { email });
    setSent(true);
  });
  return (
    <AuthCard title="Reset your password" subtitle="We will email you a secure reset link.">
      {sent ? (
        <Alert tone="success" title="Check your inbox">
          If an account exists for that address, a reset link is on its way.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="Email" required error={form.formState.errors.email?.message}>
            {(id) => <Input id={id} type="email" autoComplete="email" {...form.register('email')} />}
          </FormField>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm">
        <Link to={routes.signIn} className="text-primary hover:underline">Back to sign in</Link>
      </p>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password: z.string().min(8, 'Use at least 8 characters') })) });
  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api.post('/auth/reset-password', { token: params.get('token') ?? '', password });
      navigate(routes.signIn);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to reset your password.');
    }
  });
  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label="New password" required error={form.formState.errors.password?.message}>
          {(id) => <PasswordInput id={id} autoComplete="new-password" {...form.register('password')} />}
        </FormField>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Update password</Button>
      </form>
    </AuthCard>
  );
}

// ── Email verification ───────────────────────────────────────────
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const verify = async () => {
    try {
      await api.post('/auth/verify-email', { token: params.get('token') ?? '' });
      setState('done');
    } catch {
      setState('error');
    }
  };
  return (
    <AuthCard title="Verify your email">
      {state === 'done' ? (
        <Alert tone="success" title="Email verified"><Link to={routes.signIn} className="underline">Continue to sign in</Link></Alert>
      ) : state === 'error' ? (
        <Alert tone="danger">This verification link is invalid or has expired.</Alert>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <MailCheck className="size-10 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Click below to confirm your email address.</p>
          <Button onClick={verify}>Verify email</Button>
        </div>
      )}
    </AuthCard>
  );
}

// ── Invitation acceptance ────────────────────────────────────────
export function InvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [needsAccount, setNeedsAccount] = useState<{ email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ fullName: string; password: string }>({
    resolver: zodResolver(z.object({ fullName: z.string().min(2, 'Enter your name'), password: z.string().min(8, 'Use at least 8 characters') })),
  });

  const accept = async (extra?: { fullName: string; password: string }) => {
    setError(null);
    try {
      const { data } = await api.post<Session | { requiresAccount: true; email: string }>('/auth/accept-invitation', {
        token: params.get('token') ?? '',
        ...extra,
      });
      if ('requiresAccount' in data && data.requiresAccount) {
        setNeedsAccount({ email: data.email });
        return;
      }
      applySession(data as Session);
      navigate(routes.selectWorkspace);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'This invitation could not be accepted.');
    }
  };

  return (
    <AuthCard title="Join your team" subtitle="You have been invited to a workspace.">
      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
      {needsAccount ? (
        <form onSubmit={form.handleSubmit((v) => accept(v))} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">Create your account for <strong>{needsAccount.email}</strong>.</p>
          <FormField label="Full name" required error={form.formState.errors.fullName?.message}>
            {(id) => <Input id={id} autoComplete="name" {...form.register('fullName')} />}
          </FormField>
          <FormField label="Password" required error={form.formState.errors.password?.message}>
            {(id) => <PasswordInput id={id} autoComplete="new-password" {...form.register('password')} />}
          </FormField>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Create account & join</Button>
        </form>
      ) : (
        <Button className="w-full" onClick={() => accept()}>Accept invitation</Button>
      )}
    </AuthCard>
  );
}

// ── Status pages ─────────────────────────────────────────────────
function StatusPage({ icon, title, message, action }: { icon: React.ReactNode; title: string; message: string; action?: React.ReactNode }) {
  return (
    <AuthCard title={title}>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted [&_svg]:size-6">{icon}</div>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        {action}
      </div>
    </AuthCard>
  );
}

export function TwoFactorPlaceholderPage() {
  return (
    <StatusPage
      icon={<Lock />}
      title="Two-factor authentication"
      message="Two-factor authentication will be available soon. Your account is protected by your password in the meantime."
      action={<Button onClick={() => history.back()}>Go back</Button>}
    />
  );
}

export function SuspendedPage() {
  return (
    <StatusPage
      icon={<ShieldOff className="text-destructive" />}
      title="Account suspended"
      message="This account or workspace has been suspended. Contact your workspace owner or our support team for help."
    />
  );
}

export function AccessDeniedPage() {
  return (
    <StatusPage
      icon={<AlertTriangle className="text-warning" />}
      title="Access denied"
      message="You do not have permission to view this page. Ask a workspace administrator to grant you access."
      action={<Link to={routes.dashboard}><Button variant="outline">Back to overview</Button></Link>}
    />
  );
}

export function SessionExpiredPage() {
  return (
    <StatusPage
      icon={<Clock />}
      title="Session expired"
      message="For your security you have been signed out after a period of inactivity."
      action={<Link to={routes.signIn}><Button>Sign in again</Button></Link>}
    />
  );
}
