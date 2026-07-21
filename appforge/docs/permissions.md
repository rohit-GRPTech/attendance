# Permission model

Permissions exist at three levels. The pure evaluation logic lives in
`packages/shared/src/permissions` and is used by both the web app (UX only) and the API
(**always the final authority** — strict rule #8).

## 1. Platform roles (`users.platform_role`)

`platform_owner`, `platform_admin`, `template_creator`, `member`. Platform staff manage tenants,
plans and template approval.

## 2. Tenant roles (`memberships.role`)

`tenant_owner`, `tenant_admin`, `app_manager`, `app_user`, `read_only`. Each maps to a set of
capabilities (central map `TENANT_ROLE_CAPABILITIES`):

| Capability | Owner | Admin | App manager | App user | Read-only |
|---|---|---|---|---|---|
| workspace/members/roles/settings manage | ✓ | ✓ | — | — | — |
| billing.manage | ✓ | — | — | — | — |
| applications create/build/publish | ✓ | ✓ | ✓ | — | — |
| applications.delete | ✓ | ✓ | — | — | — |
| data.import / data.export | ✓ | ✓ | ✓ | export only | — |
| marketplace.install | ✓ | ✓ | — | — | — |
| audit.view | ✓ | ✓ | — | — | — |

API routes guard with `requireCapability('...')` middleware.

## 3. Application roles (inside the definition)

`AppRoleDef` gives each published app its own roles with:

- **Page access** — `pageIds: 'all' | string[]` plus per-page `allowedRoleIds`.
- **Entity permissions** — create/read/update/delete per entity.
- **Record scope** — `all`, `own` (creator only), `team`, `assigned`, `filtered` (declarative
  filter), `none`. `own` and `none` are enforced in the records service today; `team/assigned/
  filtered` are reserved scopes carried by the schema.
- **Field overrides** — `visible` / `editable` / `hidden` per field.
- App-wide flags: `canExport`, `canImport`, `canManageUsers`, `canManageSettings`.

Builder-capable tenant roles (owner/admin/app manager) bypass app roles; `app_user` and
`read_only` members are bound to the definition's default role. The portal endpoint returns
navigation already filtered to allowed pages; the records endpoints re-check every operation
server-side regardless of what the UI shows.
