import { Router } from 'express';
import { z } from 'zod';
import { branding, TENANT_ROLES } from '@appforge/shared';
import { env } from '../config/env';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok, created } from '../utils/respond';
import { newId, shortId, slugify } from '../utils/ids';
import { getTenantCtx, requireAuth, requireCapability, requireTenant } from '../middleware/context';
import { getEmailAdapter } from '../adapters/email';
import { recordAudit } from '../services/audit-service';

export const tenantsRouter = Router();
tenantsRouter.use(requireAuth);

/** Workspaces the signed-in user belongs to. */
tenantsRouter.get('/', async (req, res, next) => {
  try {
    const store = getStore();
    const memberships = await store.listMembershipsForUser(req.auth!.user.id);
    const rows = [];
    for (const m of memberships) {
      const tenant = await store.getTenantById(m.tenantId);
      if (tenant) rows.push({ id: tenant.id, name: tenant.name, slug: tenant.slug, planId: tenant.planId, role: m.role, suspended: Boolean(tenant.suspendedAt) });
    }
    ok(res, rows);
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/', async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(2).max(200) }).parse(req.body);
    const store = getStore();
    let slug = slugify(body.name);
    if (await store.getTenantBySlug(slug)) slug = `${slug}-${shortId(4)}`;
    const now = new Date().toISOString();
    const tenant = await store.createTenant({
      id: newId(), name: body.name, slug, planId: 'free', suspendedAt: null,
      settings: {}, createdAt: now, updatedAt: now,
    });
    await store.createMembership({ id: newId(), tenantId: tenant.id, userId: req.auth!.user.id, role: 'tenant_owner', createdAt: now });
    await store.createSubscription({
      id: newId(), tenantId: tenant.id, planId: 'free', status: 'active',
      renewsAt: new Date(Date.now() + 30 * 86400_000).toISOString(), createdAt: now,
    });
    created(res, { id: tenant.id, name: tenant.name, slug: tenant.slug, planId: tenant.planId, role: 'tenant_owner' });
  } catch (err) {
    next(err);
  }
});

tenantsRouter.get('/current', requireTenant, async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const subscription = await getStore().getSubscription(ctx.tenant.id);
    ok(res, {
      id: ctx.tenant.id,
      name: ctx.tenant.name,
      slug: ctx.tenant.slug,
      planId: ctx.tenant.planId,
      settings: ctx.tenant.settings,
      role: ctx.membership.role,
      subscription: subscription
        ? { planId: subscription.planId, status: subscription.status, renewsAt: subscription.renewsAt }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

tenantsRouter.patch('/current', requireTenant, requireCapability('workspace.manage'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z
      .object({ name: z.string().min(2).max(200).optional(), settings: z.record(z.unknown()).optional() })
      .parse(req.body);
    const updated = await getStore().updateTenant(ctx.tenant.id, {
      ...(body.name ? { name: body.name } : {}),
      ...(body.settings ? { settings: body.settings } : {}),
    });
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'settings.changed',
      resourceType: 'tenant', resourceId: ctx.tenant.id, summary: 'Workspace settings updated',
    });
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

tenantsRouter.get('/current/members', requireTenant, async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const store = getStore();
    const memberships = await store.listMembershipsForTenant(ctx.tenant.id);
    const members = [];
    for (const m of memberships) {
      const user = await store.getUserById(m.userId);
      if (user) {
        members.push({
          membershipId: m.id,
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          role: m.role,
          joinedAt: m.createdAt,
        });
      }
    }
    const invitations = (await store.listInvitations(ctx.tenant.id)).filter((i) => !i.acceptedAt);
    ok(res, { members, pendingInvitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt })) });
  } catch (err) {
    next(err);
  }
});

tenantsRouter.post('/current/invitations', requireTenant, requireCapability('members.invite'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z.object({ email: z.string().email(), role: z.enum(TENANT_ROLES) }).parse(req.body);
    const store = getStore();
    const invitation = await store.createInvitation({
      id: newId(),
      tenantId: ctx.tenant.id,
      email: body.email.toLowerCase(),
      role: body.role,
      token: shortId(24),
      invitedByUserId: ctx.user.id,
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    await getEmailAdapter().send({
      to: body.email,
      subject: `You have been invited to ${ctx.tenant.name} on ${branding.productName}`,
      text: `${ctx.user.fullName} invited you to join ${ctx.tenant.name}. Accept: ${env.WEB_BASE_URL}/auth/invitation?token=${invitation.token}`,
    });
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'user.invited',
      resourceType: 'invitation', resourceId: invitation.id,
      summary: `Invited ${body.email} as ${body.role.replace(/_/g, ' ')}`,
    });
    created(res, { id: invitation.id, email: invitation.email, role: invitation.role });
  } catch (err) {
    next(err);
  }
});

tenantsRouter.patch('/current/members/:membershipId', requireTenant, requireCapability('members.manage'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z.object({ role: z.enum(TENANT_ROLES) }).parse(req.body);
    const store = getStore();
    const memberships = await store.listMembershipsForTenant(ctx.tenant.id);
    const target = memberships.find((m) => m.id === req.params.membershipId);
    if (!target) throw ApiError.notFound('Member not found.');
    if (target.role === 'tenant_owner' && body.role !== 'tenant_owner') {
      const owners = memberships.filter((m) => m.role === 'tenant_owner');
      if (owners.length <= 1) throw ApiError.conflict('A workspace needs at least one owner.');
    }
    const updated = await store.updateMembership(target.id, { role: body.role });
    await recordAudit({
      tenantId: ctx.tenant.id, userId: ctx.user.id, action: 'role.changed',
      resourceType: 'membership', resourceId: target.id, summary: `Changed a member role to ${body.role.replace(/_/g, ' ')}`,
    });
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

tenantsRouter.delete('/current/members/:membershipId', requireTenant, requireCapability('members.manage'), async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const store = getStore();
    const memberships = await store.listMembershipsForTenant(ctx.tenant.id);
    const target = memberships.find((m) => m.id === req.params.membershipId);
    if (!target) throw ApiError.notFound('Member not found.');
    if (target.role === 'tenant_owner') throw ApiError.conflict('Transfer ownership before removing this member.');
    await store.deleteMembership(target.id);
    ok(res, { removed: true });
  } catch (err) {
    next(err);
  }
});
