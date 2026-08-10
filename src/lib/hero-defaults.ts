/**
 * The hero poster image's shipped alt text — the single source of truth both
 * `HeroSchema.posterAlt`'s zod `.default(...)` (content-schema.ts) and
 * Hero.tsx's blank-means-shipped-default fallback derive from, instead of
 * each restating its own copy.
 *
 * Zero imports here, in particular no zod: Hero.tsx is a public 'use client'
 * component, and value-importing content-schema.ts (or zod itself) from a
 * public client file drags the entire 700+ line schema into every route's
 * bundle — see the comment above `LABEL_DEFAULT_LITERALS` in
 * label-defaults.ts for the exact incident this mirrors.
 */
export const HERO_POSTER_ALT_DEFAULT =
  'Couples dancing Salsa together on a busy social floor at a Furor Latin night in Hyderabad';
