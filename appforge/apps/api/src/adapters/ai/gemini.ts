import { env } from '../../config/env';
import type {
  AiApplicationGenerator,
  AiGenerationResult,
  GenerateApplicationInput,
  ModifyApplicationInput,
  RepairApplicationInput,
} from './types';

const SYSTEM_INSTRUCTIONS = `You generate application definitions for the AppForge low-code platform.
Respond with a single JSON object only — no markdown fences, no commentary, no code.
The JSON must match the AppForge application definition schema (schemaVersion 1) with:
app{id,name,slug,description,icon,category,language,timezone,currency,dateFormat},
entities[{id,key,name,pluralName,displayFieldKey,fields[{id,key,label,type,...}]}],
pages[{id,name,slug,type,showInNavigation,layout,components[]}],
navigation[{id,label,pageId,order}], workflows[], roles[], theme{primaryColor,radius,density,mode},
settings{allowSelfRegistration,localization{language,dateFormat,currency},featureFlags}.
Field types: short_text,long_text,number,decimal,currency,percentage,boolean,date,datetime,email,phone,url,select,status,relation.
Component types: heading,paragraph,columns,stat_card,data_table,form,bar_chart,pie_chart,kanban,button,card,section.
Every id must be a unique string; keys are snake_case; slugs are kebab-case. Never include scripts or executable code.`;

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * Gemini adapter. Calls the REST generateContent endpoint with JSON response
 * mode. The API key stays server-side; the frontend only ever sees validated
 * definitions.
 */
export class GeminiGenerator implements AiApplicationGenerator {
  readonly providerName = 'gemini';

  private async call(prompt: string): Promise<AiGenerationResult> {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured. Set AI_PROVIDER=mock for local development.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini request failed with status ${res.status}`);
    const body = (await res.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let definition: unknown;
    try {
      definition = JSON.parse(text);
    } catch {
      throw new Error('Gemini returned a response that is not valid JSON.');
    }
    return {
      definition,
      model: env.GEMINI_MODEL,
      tokenUsage: {
        input: body.usageMetadata?.promptTokenCount,
        output: body.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  generateApplication(input: GenerateApplicationInput): Promise<AiGenerationResult> {
    return this.call(
      `Create an application definition.\nName: ${input.name}\nCategory: ${input.category}\nComplexity: ${input.complexity}\n` +
        `Business description: ${input.description}\n` +
        (input.requiredEntities?.length ? `Required entities: ${input.requiredEntities.join(', ')}\n` : '') +
        (input.requiredPages?.length ? `Required pages: ${input.requiredPages.join(', ')}\n` : '') +
        (input.requiredRoles?.length ? `Required roles: ${input.requiredRoles.join(', ')}\n` : '') +
        (input.requiredWorkflows?.length ? `Required workflows: ${input.requiredWorkflows.join(', ')}\n` : ''),
    );
  }

  repairApplication(input: RepairApplicationInput): Promise<AiGenerationResult> {
    return this.call(
      `Repair this application definition so it passes validation. Fix only the listed issues, keep everything else identical.\n` +
        `Issues:\n${input.issues.map((i) => `- ${i.path}: ${i.message}`).join('\n')}\n` +
        `Definition:\n${JSON.stringify(input.definition)}`,
    );
  }

  modifyApplication(input: ModifyApplicationInput): Promise<AiGenerationResult> {
    return this.call(
      `Modify this application definition according to the instruction. Return the full updated definition.\n` +
        `Instruction: ${input.instruction}\nDefinition:\n${JSON.stringify(input.definition)}`,
    );
  }
}
