import { formatPropertyCode } from '@/lib/format-code';

type PropertyLinkTarget = string | { id?: string; slug?: string };

/** Use the stable property code for new links; keep legacy slug links readable. */
export function propertyHref(property: PropertyLinkTarget): string {
  const key = typeof property === 'string'
    ? property
    : property?.id?.trim()
      ? formatPropertyCode(property.id)
      : property?.slug;

  if (!key) return '/properties';
  const encoded = encodeURIComponent(key);
  // Static hosts cannot generate a new detail path after the site is built.
  return process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true'
    ? `/properties/detail/?slug=${encoded}`
    : `/properties/${encoded}`;
}

/** Absolute URLs shared outside Next Link also need the configured site prefix. */
export function propertyUrl(property: PropertyLinkTarget, origin: string): string {
  const base = origin.replace(/\/+$/, '');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const siteBase = /^https?:\/\/[^/]+$/.test(base) ? `${base}${basePath}` : base;
  return `${siteBase}${propertyHref(property)}`;
}
