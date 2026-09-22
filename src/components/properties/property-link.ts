export function propertyHref(slug: string): string {
  return '/properties/' + encodeURIComponent(slug);
}
