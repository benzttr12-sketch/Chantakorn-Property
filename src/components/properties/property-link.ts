import { SAMPLE_PROPERTIES } from '@/data/sample-properties';

const staticSlugs = new Set(SAMPLE_PROPERTIES.map(property => property.slug));

export function propertyHref(slug: string): string {
  return process.env.NEXT_PUBLIC_DATA_BACKEND === 'local' && staticSlugs.has(slug)
    ? '/properties/' + encodeURIComponent(slug)
    : '/properties/detail?slug=' + encodeURIComponent(slug);
}
