import { Router } from 'express';
import { z } from 'zod';
import { BUSINESS_CATEGORIES, PLANS } from '@appforge/shared';
import { getStore } from '../storage';
import { ApiError } from '../utils/errors';
import { ok } from '../utils/respond';
import { newId } from '../utils/ids';
import { getTenantCtx, requireAuth, requireCapability, requireTenant } from '../middleware/context';
import { getAiGenerator, PROMPT_VERSION } from '../adapters/ai';
import { validateWithRegistry } from '../services/definition-service';

export const aiRouter = Router();
aiRouter.use(requireAuth, requireTenant, requireCapability('applications.create'));

const generateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(10).max(4000),
  category: z.enum(BUSINESS_CATEGORIES).default('custom'),
  complexity: z.enum(['simple', 'standard', 'advanced']).default('standard'),
  requiredEntities: z.array(z.string().max(80)).max(30).optional(),
  requiredPages: z.array(z.string().max(80)).max(30).optional(),
  requiredRoles: z.array(z.string().max(80)).max(10).optional(),
  requiredWorkflows: z.array(z.string().max(120)).max(20).optional(),
  includeSampleRecords: z.boolean().optional(),
});

async function logGeneration(input: {
  tenantId: string; userId: string; provider: string; model: string;
  status: 'succeeded' | 'validation_failed' | 'provider_error';
  validationErrors?: unknown[]; tokenUsage?: { input?: number; output?: number } | null;
}) {
  await getStore().createAiGeneration({
    id: newId(), tenantId: input.tenantId, userId: input.userId, applicationId: null,
    provider: input.provider, model: input.model, promptVersion: PROMPT_VERSION,
    status: input.status, validationErrors: input.validationErrors ?? [],
    tokenUsage: input.tokenUsage ?? null, createdAt: new Date().toISOString(),
  });
}

/**
 * Generates a draft definition. The provider's raw JSON is always validated
 * against the application schema + component registry; only validated output
 * (or the raw draft with its issue list, for the repair loop) reaches the client.
 */
aiRouter.post('/generate', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const input = generateSchema.parse(req.body);
    const generator = getAiGenerator();

    const limits = PLANS[ctx.tenant.planId].limits;
    if (limits.aiGenerationsPerMonth !== -1) {
      const recent = (await getStore().listAiGenerations(ctx.tenant.id)).filter(
        (g) => Date.parse(g.createdAt) > Date.now() - 30 * 86400_000,
      );
      if (recent.length >= limits.aiGenerationsPerMonth) {
        throw ApiError.planLimit('You have used all AI generations included in your plan this month.');
      }
    }

    let result;
    try {
      result = await generator.generateApplication(input);
    } catch (err) {
      await logGeneration({
        tenantId: ctx.tenant.id, userId: ctx.user.id, provider: generator.providerName,
        model: 'unknown', status: 'provider_error',
      });
      throw ApiError.badRequest(
        'The AI provider could not generate an application. Please try again or adjust your description.',
        [String(err instanceof Error ? err.message : err)],
      );
    }

    const { definition, issues } = validateWithRegistry(result.definition);
    await logGeneration({
      tenantId: ctx.tenant.id, userId: ctx.user.id, provider: generator.providerName,
      model: result.model, status: definition ? 'succeeded' : 'validation_failed',
      validationErrors: issues.filter((i) => i.severity === 'error'), tokenUsage: result.tokenUsage,
    });

    ok(res, {
      valid: Boolean(definition),
      definition: definition ?? result.definition,
      issues,
      provider: generator.providerName,
      model: result.model,
    });
  } catch (err) {
    next(err);
  }
});

aiRouter.post('/repair', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    const body = z
      .object({
        definition: z.unknown(),
        issues: z.array(z.object({ path: z.string(), message: z.string() })).max(100),
      })
      .parse(req.body);
    const generator = getAiGenerator();
    const result = await generator.repairApplication({ definition: body.definition, issues: body.issues });
    const { definition, issues } = validateWithRegistry(result.definition);
    await logGeneration({
      tenantId: ctx.tenant.id, userId: ctx.user.id, provider: generator.providerName,
      model: result.model, status: definition ? 'succeeded' : 'validation_failed',
      validationErrors: issues.filter((i) => i.severity === 'error'), tokenUsage: result.tokenUsage,
    });
    ok(res, { valid: Boolean(definition), definition: definition ?? result.definition, issues });
  } catch (err) {
    next(err);
  }
});

aiRouter.get('/logs', async (req, res, next) => {
  try {
    const ctx = getTenantCtx(req);
    ok(res, await getStore().listAiGenerations(ctx.tenant.id));
  } catch (err) {
    next(err);
  }
});
