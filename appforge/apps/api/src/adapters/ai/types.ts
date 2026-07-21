import type { ApplicationDefinition, BusinessCategory } from '@appforge/shared';

export interface GenerateApplicationInput {
  name: string;
  description: string;
  category: BusinessCategory;
  complexity: 'simple' | 'standard' | 'advanced';
  requiredEntities?: string[];
  requiredPages?: string[];
  requiredRoles?: string[];
  requiredWorkflows?: string[];
  includeSampleRecords?: boolean;
}

export interface RepairApplicationInput {
  definition: unknown;
  issues: Array<{ path: string; message: string }>;
}

export interface ModifyApplicationInput {
  definition: ApplicationDefinition;
  instruction: string;
}

export interface AiGenerationResult {
  definition: unknown;
  tokenUsage: { input?: number; output?: number } | null;
  model: string;
}

/**
 * Provider-agnostic AI application generator. Implementations must return raw
 * candidate JSON — the caller always validates against the application schema
 * before anything is persisted. Never wire a provider into the frontend.
 */
export interface AiApplicationGenerator {
  readonly providerName: string;
  generateApplication(input: GenerateApplicationInput): Promise<AiGenerationResult>;
  repairApplication(input: RepairApplicationInput): Promise<AiGenerationResult>;
  modifyApplication(input: ModifyApplicationInput): Promise<AiGenerationResult>;
}

export const PROMPT_VERSION = '2026-07-1';
