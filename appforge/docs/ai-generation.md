# AI application generation

## Provider abstraction

`apps/api/src/adapters/ai/types.ts`:

```ts
interface AiApplicationGenerator {
  providerName: string;
  generateApplication(input: GenerateApplicationInput): Promise<AiGenerationResult>;
  repairApplication(input: RepairApplicationInput): Promise<AiGenerationResult>;
  modifyApplication(input: ModifyApplicationInput): Promise<AiGenerationResult>;
}
```

Implementations:

- **GeminiGenerator** — calls the Gemini REST `generateContent` endpoint in JSON response mode
  with a strict system instruction describing the schema. The API key lives only in server
  environment variables (strict rule #3). Select with `AI_PROVIDER=gemini` + `GEMINI_API_KEY`.
- **MockGenerator** (default) — deterministic: picks the closest sample definition to the
  described business and rebrands/trims it. Lets the whole pipeline run offline.

Adding OpenAI/Anthropic/local models = one new adapter file; nothing else changes (strict
rule #18).

## Pipeline (server-side, `POST /api/v1/ai/generate`)

1. Validate the request (name, description, category, complexity, modules) with Zod.
2. Enforce the plan's monthly AI generation quota.
3. Call the provider — its output is treated as **untrusted candidate JSON**.
4. Run `validateWithRegistry`: schema migration → Zod structure → referential integrity →
   component-registry membership.
5. Log the generation (`ai_generations`): provider, model, prompt version, status, validation
   errors, token usage, user, tenant.
6. Return `{ valid, definition, issues }`. Invalid drafts are returned **with their issues** for
   the repair loop (`POST /ai/repair`) — they are never saved.
7. The user reviews the visual summary and accepts → `POST /applications` re-validates and
   clones with fresh ids before saving as a draft. An invalid definition cannot be persisted.

## Prompt versioning

`PROMPT_VERSION` is stored with every log row so prompt changes can be correlated with
validation failure rates.
