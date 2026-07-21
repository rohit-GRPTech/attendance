import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { ApiError } from '../utils/errors';
import { getStore } from '../storage';
import type { MembershipRow, TenantRow, UserRow } from '../storage/types';
import { tenantRoleCan, type TenantCapability } from '@appforge/shared';

export interface AuthContext {
  user: UserRow;
}

export interface TenantContext extends AuthContext {
  tenant: TenantRow;
  membership: MembershipRow;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    tenantCtx?: TenantContext;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  res.locals.requestId = randomUUID();
  res.setHeader('X-Request-Id', res.locals.requestId);
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/** Fixed-window in-memory rate limiter — replace with a shared store when scaling horizontally. */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > env.RATE_LIMIT_MAX) {
    return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.'));
  }
  next();
}

interface AccessTokenPayload {
  sub: string;
  type: 'access' | 'refresh';
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'access' } satisfies AccessTokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies AccessTokenPayload, env.JWT_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string, type: 'access' | 'refresh'): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    if (payload.type !== type) throw new Error('wrong token type');
    return payload.sub;
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
}

/** Authenticates the request from the Authorization bearer token. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();
    const userId = verifyToken(header.slice(7), 'access');
    const user = await getStore().getUserById(userId);
    if (!user) throw ApiError.unauthorized();
    if (user.suspendedAt) throw new ApiError(403, 'FORBIDDEN', 'This account has been suspended.');
    req.auth = { user };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Resolves the active tenant. The client sends the selected workspace slug in
 * the X-Workspace header, but it is only an *identifier* — access is granted
 * exclusively from the server-side membership lookup for the authenticated
 * user. A slug the user does not belong to yields 403, never data.
 */
export async function requireTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) throw ApiError.unauthorized();
    const slug = String(req.headers['x-workspace'] ?? '');
    if (!slug) throw ApiError.badRequest('No workspace selected.');
    const tenant = await getStore().getTenantBySlug(slug);
    if (!tenant) throw ApiError.notFound('Workspace not found.');
    const membership = await getStore().getMembership(tenant.id, auth.user.id);
    if (!membership) throw ApiError.forbidden('You are not a member of this workspace.');
    if (tenant.suspendedAt) throw new ApiError(403, 'TENANT_SUSPENDED', 'This workspace is suspended.');
    req.tenantCtx = { ...auth, tenant, membership };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireCapability(capability: TenantCapability) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ctx = req.tenantCtx;
    if (!ctx) return next(ApiError.unauthorized());
    if (!tenantRoleCan(ctx.membership.role, capability)) {
      return next(ApiError.forbidden('Your role does not allow this action.'));
    }
    next();
  };
}

export function getTenantCtx(req: Request): TenantContext {
  if (!req.tenantCtx) throw ApiError.unauthorized();
  return req.tenantCtx;
}
