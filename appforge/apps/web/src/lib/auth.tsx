import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, loadSession, saveSession, type Session, type SessionWorkspace } from './api';

interface AuthContextValue {
  session: Session | null;
  workspace: SessionWorkspace | null;
  signIn(email: string, password: string): Promise<Session>;
  register(input: { fullName: string; email: string; password: string; workspaceName: string }): Promise<Session>;
  applySession(session: Session): void;
  selectWorkspace(slug: string): void;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  useEffect(() => {
    const sync = () => setSession(loadSession());
    window.addEventListener('appforge-session', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('appforge-session', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const applySession = useCallback((next: Session) => {
    const active = next.activeWorkspaceSlug ?? (next.workspaces.length === 1 ? next.workspaces[0]?.slug : undefined);
    const withActive = { ...next, activeWorkspaceSlug: active };
    saveSession(withActive);
    setSession(withActive);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<Session>('/auth/login', { email, password });
      applySession(data);
      return data;
    },
    [applySession],
  );

  const register = useCallback(
    async (input: { fullName: string; email: string; password: string; workspaceName: string }) => {
      const { data } = await api.post<Session>('/auth/register', input);
      applySession(data);
      return data;
    },
    [applySession],
  );

  const selectWorkspace = useCallback((slug: string) => {
    const current = loadSession();
    if (!current) return;
    saveSession({ ...current, activeWorkspaceSlug: slug });
    setSession({ ...current, activeWorkspaceSlug: slug });
  }, []);

  const signOut = useCallback(() => {
    void api.post('/auth/logout').catch(() => undefined);
    saveSession(null);
    setSession(null);
  }, []);

  const workspace = useMemo(
    () => session?.workspaces.find((w) => w.slug === session.activeWorkspaceSlug) ?? null,
    [session],
  );

  const value = useMemo(
    () => ({ session, workspace, signIn, register, applySession, selectWorkspace, signOut }),
    [session, workspace, signIn, register, applySession, selectWorkspace, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
