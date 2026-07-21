import { crmSample, inventorySample, serviceJobsSample, type ApplicationDefinition } from '@appforge/shared';
import { newId, slugify } from '../../utils/ids';
import type {
  AiApplicationGenerator,
  AiGenerationResult,
  GenerateApplicationInput,
  ModifyApplicationInput,
  RepairApplicationInput,
} from './types';

/**
 * Deterministic mock provider for development and demos: picks the closest
 * sample definition to the described business and rebrands it. Exercises the
 * full validate → preview → accept pipeline without external calls.
 */
export class MockGenerator implements AiApplicationGenerator {
  readonly providerName = 'mock';

  async generateApplication(input: GenerateApplicationInput): Promise<AiGenerationResult> {
    const text = `${input.name} ${input.description}`.toLowerCase();
    let base: ApplicationDefinition = crmSample;
    if (/stock|inventor|warehouse|product|supplier|order/.test(text)) base = inventorySample;
    else if (/service|repair|job|technician|invoice|vehicle|maintenance|appointment/.test(text)) base = serviceJobsSample;

    const definition: ApplicationDefinition = JSON.parse(JSON.stringify(base));
    definition.app = {
      ...definition.app,
      id: newId(),
      name: input.name,
      slug: slugify(input.name),
      description: input.description.slice(0, 900),
      category: input.category,
    };
    if (input.complexity === 'simple') {
      definition.workflows = definition.workflows.slice(0, 1);
      definition.entities = definition.entities.slice(0, 4);
      const keptKeys = new Set(definition.entities.map((e) => e.key));
      definition.pages = definition.pages.filter(
        (p) => !p.dataSource || keptKeys.has(p.dataSource.entityKey),
      );
      const keptPageIds = new Set(definition.pages.map((p) => p.id));
      definition.navigation = definition.navigation.filter((n) => keptPageIds.has(n.pageId));
      for (const entity of definition.entities) {
        entity.fields = entity.fields.filter(
          (f) => !f.relation || keptKeys.has(f.relation.targetEntityKey),
        );
      }
      for (const role of definition.roles) {
        role.entityPermissions = role.entityPermissions.filter((p) => keptKeys.has(p.entityKey));
      }
      const validWorkflows = definition.workflows.filter(
        (w) => !w.trigger.entityKey || keptKeys.has(w.trigger.entityKey),
      );
      definition.workflows = validWorkflows;
    }
    return { definition, model: 'appforge-mock-1', tokenUsage: { input: 350, output: 2200 } };
  }

  async repairApplication(input: RepairApplicationInput): Promise<AiGenerationResult> {
    // The mock cannot truly repair arbitrary JSON; return the definition unchanged
    // so the validation loop surfaces remaining issues honestly.
    return { definition: input.definition, model: 'appforge-mock-1', tokenUsage: null };
  }

  async modifyApplication(input: ModifyApplicationInput): Promise<AiGenerationResult> {
    return { definition: input.definition, model: 'appforge-mock-1', tokenUsage: null };
  }
}
