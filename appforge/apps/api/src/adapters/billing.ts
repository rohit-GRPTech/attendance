import { PLANS, type PlanId } from '@appforge/shared';

/**
 * Billing provider abstraction. The MVP ships a no-op provider that keeps the
 * subscription rows accurate; a Stripe (or similar) provider can implement
 * this same interface without touching the rest of the platform.
 */
export interface BillingProvider {
  createCheckout(tenantId: string, planId: PlanId): Promise<{ checkoutUrl: string }>;
  cancelSubscription(tenantId: string): Promise<void>;
}

class PlaceholderBillingProvider implements BillingProvider {
  async createCheckout(tenantId: string, planId: PlanId): Promise<{ checkoutUrl: string }> {
    return { checkoutUrl: `/settings/billing?upgraded=${planId}&tenant=${tenantId}` };
  }
  async cancelSubscription(): Promise<void> {}
}

let provider: BillingProvider | null = null;
export function getBillingProvider(): BillingProvider {
  if (!provider) provider = new PlaceholderBillingProvider();
  return provider;
}

export function planLimits(planId: PlanId) {
  return PLANS[planId].limits;
}
