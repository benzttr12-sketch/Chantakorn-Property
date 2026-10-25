import { formatPropertyCode } from '@/lib/format-code';
import { BUILT_PROPERTY_ROUTES } from '@/lib/generated-static-routes';

type PropertyLinkTarget = string | { id?: string; slug?: string; code?: string };

/** Use the stable property code for new links; keep legacy slug links readable. */
export function propertyHref(property: PropertyLinkTarget): string {
  const key = typeof property === 'string'
    ? property
    : property?.code && /^CK-[A-Z0-9]+$/i.test(property.code)
      ? property.code.toUpperCase()
      : property?.id?.trim()
        ? process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND === 'cloudflare'
          ? property.id.trim()
          : formatPropertyCode(property.id)
        : property?.slug;

  if (!key) return '/properties';
  const encoded = encodeURIComponent(key);
  // Static hosts cannot generate a new detail path after the site is built,
  // so link to the pretty path only when that page really exists at build
  // time; listings added after the deploy keep the query-param route.
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true' && !BUILT_PROPERTY_ROUTES.includes(key)) {
    return `/properties/detail/?slug=${encoded}`;
  }
  return `/properties/${encoded}`;
}

/** Absolute URLs shared outside Next Link also need the configured site prefix. */
export function propertyUrl(property: PropertyLinkTarget, origin: string): string {
  const base = origin.replace(/\/+$/, '');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const siteBase = /^https?:\/\/[^/]+$/.test(base) ? `${base}${basePath}` : base;
  return `${siteBase}${propertyHref(property)}`;
}
