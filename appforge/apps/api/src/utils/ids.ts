import { randomUUID } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}

/** Short public-facing identifier (slugs, invite codes). */
export function shortId(length = 10): string {
  return randomUUID().replace(/-/g, '').slice(0, length);
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `app-${shortId(6)}`;
}
