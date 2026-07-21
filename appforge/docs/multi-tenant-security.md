# Multi-tenant security

## Tenant resolution — never trust the client

The client sends the selected workspace slug in the `X-Workspace` header, but the slug is only a
*selector*. `requireTenant` middleware:

1. authenticates the JWT and loads the user,
2. looks up the tenant by slug,
3. **loads the membership row for (tenant, user) — no membership, no access (403)**,
4. rejects suspended tenants and suspended users.

A tenant id or slug from the frontend can therefore never grant access to another tenant's data
(strict rule #4).

## Structural query scoping

The `Store` interface (`apps/api/src/storage/types.ts`) has **no unscoped read/write methods for
tenant data** — every method takes `tenantId` and both implementations filter on it. Records are
additionally scoped by `applicationId` and `entityKey`. This makes cross-tenant leakage a type
error rather than a code-review hope, and protects against insecure direct object references:
fetching a record by id still requires the id to match the caller's tenant + application.

## Layered checks per request

| Layer | Mechanism |
|---|---|
| Authentication | Bearer JWT (1h) + refresh token (30d); bcrypt(10) password hashes |
| Tenant | membership lookup (above) |
| Capability | `requireCapability` from the central role→capability map |
| App role | entity CRUD + record scope + page access from the published definition |
| Payload | Zod schema generated from the entity definition; unknown keys stripped (mass-assignment protection) |
| Plan limits | central `PLANS` constants (apps, records, AI generations) |
| Audit | every significant action writes an `audit_logs` row |

## Other protections

- **No code execution**: definitions contain JSON-only props/configs validated against the
  registry; workflows execute typed nodes; templates are cloned structures with fresh ids.
- **Templates never contain customer records** — publishing a template clones the definition
  only (strict rule #17).
- **Rate limiting** per IP (fixed window, configurable) and JSON body limit (2 MB).
- **Security headers** (nosniff, frame-deny, referrer-policy, permissions-policy) and CORS
  restricted to configured origins with an explicit header allowlist.
- **Error normalization**: all errors → `{ success:false, error:{ code, message, details } }`;
  stack traces and internal messages are suppressed in production; forgot-password always
  succeeds to prevent account enumeration.
- **Environment validation** on boot; refuses to start in production with the default JWT secret.
- **Suspension**: suspended users and tenants are cut off at middleware level.
- **Public identifiers**: URLs use slugs; internal ids are UUIDs, never sequential.

## Known MVP boundaries (documented, not hidden)

- Refresh tokens are stateless JWTs (no server-side revocation list yet) — the endpoint shape
  supports adding a denylist without contract changes.
- `team/assigned/filtered` record scopes are carried by the schema but enforced as `all` today.
- Rate limiting is in-process; move to a shared store when scaling horizontally.
