# Application JSON schema

Every application is a single versioned JSON document — the `ApplicationDefinition` — defined in
`packages/shared/src/types/application.ts` and validated by
`packages/shared/src/schema/application-schema.ts`.

## Top level

```jsonc
{
  "schemaVersion": 1,
  "app":        { "id", "name", "slug", "description", "icon", "category",
                  "language", "timezone", "currency", "dateFormat" },
  "entities":   [ /* data tables */ ],
  "pages":      [ /* page trees of components */ ],
  "navigation": [ { "id", "label", "icon", "pageId", "order" } ],
  "workflows":  [ /* declarative automations */ ],
  "roles":      [ /* app-level roles & permissions */ ],
  "theme":      { "primaryColor", "radius", "density", "mode" },
  "settings":   { "allowSelfRegistration", "defaultRoleId", "localization", "featureFlags" }
}
```

Rules enforced by validation:

- Every major object has a **stable unique id** — array indexes are never identifiers.
- Keys are `snake_case`, slugs are kebab-case; length limits everywhere.
- Component `type` must exist in the component registry; `props` are JSON scalars/arrays/objects
  only (recursively limited) — **no executable content is representable**.
- Referential integrity: navigation → pages, data sources → entities, relations → entities,
  workflow edges → nodes (and no cycles), role references → roles.
- A definition with errors is rejected on save and on publish; warnings (e.g. "no home page")
  are surfaced but non-blocking.

## Entities and fields

`EntityDef` — id, key, name/pluralName, icon, `displayFieldKey`, `fields[]`, softDelete,
timestamps, auditTracking. `EntityFieldDef` supports 26 field types (short/long/rich text,
number, decimal, currency, percentage, boolean, date/datetime/time, email, phone, url,
select/multi-select/status with options, file, image, user, relation, formula placeholder,
auto number, uuid, address, json) plus validation settings (required, unique, min/max,
min/max length, pattern, default, conditional visibility hooks).

Relations declare `kind` (`one_to_one` … `many_to_many`), `targetEntityKey` and an optional
`displayFieldKey`; record values store the related record id.

## Versioning & migrations

`schemaVersion` is compared to `CURRENT_SCHEMA_VERSION`. `migrateDefinition` (in
`schema/migrations.ts`) runs registered per-version migrations on load, so old stored
definitions upgrade transparently. The same module provides:

- `diffDefinitions(a, b)` — structural diff for version history UI,
- `cloneDefinitionWithNewIds` — deep clone with consistent id remapping, used for duplication
  and template installation (guarantees no id collisions across tenants).

## Import / export

- Export: `GET /api/v1/applications/:id/export` returns the draft definition as JSON.
- Import: `POST /api/v1/applications` with a `definition` — it is validated, cloned with fresh
  ids and saved as a new draft. Invalid definitions are rejected with the issue list.
