import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { branding } from '@appforge/shared';
import { env } from '../config/env';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok, created } from '../utils/respond';
import { newId, shortId, slugify } from '../utils/ids';
import { requireAuth, signAccessToken, signRefreshToken, verifyToken } from '../middleware/context';
import { getEmailAdapter } from '../adapters/email';
import { recordAudit } from '../services/audit-service';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
});

const registerSchema = credentialsSchema.extend({
  fullName: z.string().min(2).max(200),
  workspaceName: z.string().min(2).max(200),
});

function publicUser(user: { id: string; email: string; fullName: string; platformRole: string; emailVerifiedAt: string | null }) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    platformRole: user.platformRole,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

async function issueSession(user: { id: string; email: string; fullName: string; platformRole: string; emailVerifiedAt: string | null }) {
  const memberships = await getStore().listMembershipsForUser(user.id);
  const workspaces = await Promise.all(
    memberships.map(async (m) => {
      const tenant = await getStore().getTenantById(m.tenantId);
      return tenant && !tenant.suspendedAt
        ? { id: tenant.id, name: tenant.name, slug: tenant.slug, planId: tenant.planId, role: m.role }
        : null;
    }),
  );
  return {
    user: publicUser(user),
    workspaces: workspaces.filter((w): w is NonNullable<typeof w> => w !== null),
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
  };
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const store = getStore();
    const email = input.email.toLowerCase();
    if (await store.getUserByEmail(email)) {
      throw ApiError.conflict('An account with this email already exists. Try signing in instead.');
    }
    const now = new Date().toISOString();
    const user = await store.createUser({
      id: newId(),
      email,
      passwordHash: await bcrypt.hash(input.password, 10),
      fullName: input.fullName,
      platformRole: 'member',
      emailVerifiedAt: null,
      suspendedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    let slug = slugify(input.workspaceName);
    if (await store.getTenantBySlug(slug)) slug = `${slug}-${shortId(4)}`;
    const tenant = await store.createTenant({
      id: newId(), name: input.workspaceName, slug, planId: 'free',
      suspendedAt: null, settings: {}, createdAt: now, updatedAt: now,
    });
    await store.createMembership({ id: newId(), tenantId: tenant.id, userId: user.id, role: 'tenant_owner', createdAt: now });
    await store.createSubscription({
      id: newId(), tenantId: tenant.id, planId: 'free', status: 'active',
      renewsAt: new Date(Date.now() + 30 * 86400_000).toISOString(), createdAt: now,
    });

    const verifyToken = jwt.sign({ sub: user.id, type: 'verify' }, env.JWT_SECRET, { expiresIn: '2d' });
    await getEmailAdapter().send({
      to: email,
      subject: `Verify your ${branding.productName} email`,
      text: `Welcome to ${branding.productName}! Verify your email: ${env.WEB_BASE_URL}/auth/verify-email?token=${verifyToken}`,
    });

    created(res, await issueSession(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = credentialsSchema.parse(req.body);
    const store = getStore();
    const user = await store.getUserByEmail(input.email);
    const valid = user && (await bcrypt.compare(input.password, user.passwordHash));
    if (!user || !valid) throw ApiError.unauthorized('Incorrect email or password.');
    if (user.suspendedAt) throw new ApiError(403, 'FORBIDDEN', 'This account has been suspended.');
    const session = await issueSession(user);
    const firstWorkspace = session.workspaces[0];
    if (firstWorkspace) {
      await recordAudit({
        tenantId: firstWorkspace.id, userId: user.id, action: 'user.login',
        resourceType: 'user', resourceId: user.id, summary: `${user.fullName} signed in`,
        ipAddress: req.ip,
      });
    }
    ok(res, session);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const userId = verifyToken(body.refreshToken, 'refresh');
    const user = await getStore().getUserById(userId);
    if (!user || user.suspendedAt) throw ApiError.unauthorized();
    ok(res, await issueSession(user));
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = req.auth!.user;
    ok(res, await issueSession(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const user = await getStore().getUserByEmail(body.email);
    if (user) {
      const token = jwt.sign({ sub: user.id, type: 'reset' }, env.JWT_SECRET, { expiresIn: '1h' });
      await getEmailAdapter().send({
        to: user.email,
        subject: `Reset your ${branding.productName} password`,
        text: `Reset your password: ${env.WEB_BASE_URL}/auth/reset-password?token=${token}`,
      });
    }
    // Always succeed to avoid account enumeration.
    ok(res, { sent: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const body = z.object({ token: z.string(), password: z.string().min(8).max(200) }).parse(req.body);
    let payload: { sub: string; type: string };
    try {
      payload = jwt.verify(body.token, env.JWT_SECRET) as { sub: string; type: string };
    } catch {
      throw ApiError.badRequest('This reset link is invalid or has expired.');
    }
    if (payload.type !== 'reset') throw ApiError.badRequest('This reset link is invalid or has expired.');
    await getStore().updateUser(payload.sub, { passwordHash: await bcrypt.hash(body.password, 10) });
    ok(res, { reset: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const body = z.object({ token: z.string() }).parse(req.body);
    let payload: { sub: string; type: string };
    try {
      payload = jwt.verify(body.token, env.JWT_SECRET) as { sub: string; type: string };
    } catch {
      throw ApiError.badRequest('This verification link is invalid or has expired.');
    }
    if (payload.type !== 'verify') throw ApiError.badRequest('This verification link is invalid or has expired.');
    await getStore().updateUser(payload.sub, { emailVerifiedAt: new Date().toISOString() });
    ok(res, { verified: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/accept-invitation', async (req, res, next) => {
  try {
    const body = z
      .object({
        token: z.string(),
        fullName: z.string().min(2).max(200).optional(),
        password: z.string().min(8).max(200).optional(),
      })
      .parse(req.body);
    const store = getStore();
    const invitation = await store.getInvitationByToken(body.token);
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date().toISOString()) {
      throw ApiError.badRequest('This invitation is invalid or has expired.');
    }
    let user = await store.getUserByEmail(invitation.email);
    if (!user) {
      if (!body.fullName || !body.password) {
        // Frontend uses this signal to show the account-creation form.
        ok(res, { requiresAccount: true, email: invitation.email });
        return;
      }
      const now = new Date().toISOString();
      user = await store.createUser({
        id: newId(),
        email: invitation.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        fullName: body.fullName,
        platformRole: 'member',
        emailVerifiedAt: now,
        suspendedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (!(await store.getMembership(invitation.tenantId, user.id))) {
      await store.createMembership({
        id: newId(), tenantId: invitation.tenantId, userId: user.id,
        role: invitation.role, createdAt: new Date().toISOString(),
      });
    }
    await store.updateInvitation(invitation.id, { acceptedAt: new Date().toISOString() });
    ok(res, await issueSession(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (_req, res) => {
  // Stateless JWT logout: the client discards tokens. A denylist can be added
  // behind this endpoint without changing the contract.
  ok(res, { loggedOut: true });
});
