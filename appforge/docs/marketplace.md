# Marketplace workflow

## Publishing a template (seller side)

1. Build and refine an application in a workspace on a plan with `marketplacePublishing`
   (Business+).
2. Seller dashboard → **Create template**: choose the source application, name, descriptions
   and price.
3. The API clones the application's definition with fresh ids
   (`cloneDefinitionWithNewIds`) — **structure only; customer records are never included**.
4. The template is created with status `pending_review`; a platform administrator approves it to
   `published` (status field ready; approval UI is a platform-admin follow-up).
5. Sales metrics (installs, estimated revenue, ratings) appear on the seller dashboard.

## Installing a template (buyer side)

1. Browse `/marketplace` — search, category filter, featured/free/paid badges, ratings.
2. Template detail page shows included entities, pages, automations, roles, creator and price.
3. **Install**: requires the `marketplace.install` capability and available application quota.
   For paid templates the billing provider abstraction records the purchase price (the MVP
   placeholder applies it directly; a Stripe-style provider slots in behind
   `BillingProvider.createCheckout`).
4. The definition is cloned with fresh ids into a tenant-owned draft application, a `purchases`
   row is written, the install counter increments and an audit entry is recorded.
5. The buyer lands in the builder to customise, then publishes to their portal.

## Data boundaries

- Templates are platform-wide listings; purchases and installed applications are tenant-scoped.
- Installing never links back to the seller's data; updates to a template do not mutate
  installed applications (they are independent clones).
