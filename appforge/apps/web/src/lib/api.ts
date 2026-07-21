import type { ApiResponse } from '@appforge/shared';

/**
 * API client: bearer auth, workspace header, one automatic refresh on 401,
 * and typed envelope handling. Tokens live in localStorage; the workspace
 * header is only a selector — the server enforces membership.
 */

const STORAGE_KEY = 'appforge.session';

export interface SessionWorkspace {
  id: string;
  name: string;
  slug: string;
  planId: string;
  role: string;
}

export interface Session {
  user: { id: string; email: string; fullName: string; platformRole: string; emailVerified: boolean };
  workspaces: SessionWorkspace[];
  accessToken: string;
  refreshToken: string;
  activeWorkspaceSlug?: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('appforge-session'));
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: unknown[] = [],
  ) {
    super(message);
  }
}

async function rawRequest<T>(path: string, options: RequestInit, retry = true): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const session = loadSession();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (session?.activeWorkspaceSlug) headers.set('X-Workspace', session.activeWorkspaceSlug);

  const res = await fetch(`/api/v1${path}`, { ...options, headers });
  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError('INTERNAL_ERROR', 'The server returned an unexpected response.', res.status);
  }

  if (!body.success) {
    if (res.status === 401 && retry && session?.refreshToken && !path.startsWith('/auth/')) {
      const refreshed = await tryRefresh(session);
      if (refreshed) return rawRequest<T>(path, options, false);
      saveSession(null);
    }
    throw new ApiRequestError(body.error.code, body.error.message, res.status, body.error.details ?? []);
  }
  return { data: body.data, meta: body.meta as Record<string, unknown> | undefined };
}

async function tryRefresh(session: Session): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    const body = (await res.json()) as ApiResponse<Session>;
    if (!body.success) return false;
    saveSession({ ...body.data, activeWorkspaceSlug: session.activeWorkspaceSlug });
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string) => rawRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => rawRequest<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => rawRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => rawRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => rawRequest<T>(path, { method: 'DELETE' }),
};
