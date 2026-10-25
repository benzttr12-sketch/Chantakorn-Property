/**
 * Property detail routes that the static export actually generated.
 * The Pages build (scripts/build-pages.mjs) rewrites this file with the real
 * slug/id/code list before `next build` and restores it afterwards; every
 * other build keeps the empty default. property-link.ts uses it to emit a
 * pretty /properties/<slug> URL only when that page truly exists, falling
 * back to the query-param detail route for listings added after deploy.
 */
export const BUILT_PROPERTY_ROUTES: readonly string[] = [];
