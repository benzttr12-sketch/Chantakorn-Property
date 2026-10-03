import { Property } from '@/lib/types';

export function propertyHref(propOrSlug: string | Property | { slug?: string; id?: string }): string {
  if (!propOrSlug) return '/properties';
  if (typeof propOrSlug === 'string') {
    return '/properties/' + encodeURIComponent(propOrSlug);
  }
  const slug = propOrSlug.slug || propOrSlug.id || '';
  return '/properties/' + encodeURIComponent(slug);
}
