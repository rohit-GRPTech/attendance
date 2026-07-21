import { env } from '../../config/env';
import { GeminiGenerator } from './gemini';
import { MockGenerator } from './mock';
import type { AiApplicationGenerator } from './types';

let generator: AiApplicationGenerator | null = null;

export function getAiGenerator(): AiApplicationGenerator {
  if (!generator) {
    generator = env.AI_PROVIDER === 'gemini' ? new GeminiGenerator() : new MockGenerator();
  }
  return generator;
}

export * from './types';
