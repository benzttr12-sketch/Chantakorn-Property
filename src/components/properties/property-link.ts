import { Property } from '@/lib/types';

export function propertyHref(propOrSlug: string | Property | { slug?: string; id?: string }): string {
  if (!propOrSlug) return '/properties';
  const slug = typeof propOrSlug === 'string'
    ? propOrSlug
    : propOrSlug.slug || propOrSlug.id || '';

  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true') {
    return `/properties/detail/?slug=${encodeURIComponent(slug)}`;
  }

  if (typeof propOrSlug === 'string') {
    return '/properties/' + encodeURIComponent(slug);
  }
  return '/properties/' + encodeURIComponent(slug);
}
