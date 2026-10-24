import type { MetadataRoute } from 'next';
import { propertyUrl } from '@/lib/property-link';
import { sitemapCatalog } from '@/lib/sitemap-catalog';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://chantakornproperty.com').replace(/\/+$/, '');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const siteBase = /^https?:\/\/[^/]+$/.test(baseUrl) ? baseUrl + basePath : baseUrl;
  const staticPages: MetadataRoute.Sitemap = [
    '', '/properties', '/buy', '/rent', '/sell', '/services', '/about', '/contact',
  ].map(route => ({ url: `${siteBase}${route}`, changeFrequency: 'weekly', priority: route === '' ? 1 : 0.8 }));
  try {
    const rows = await sitemapCatalog();
    const entries = new Map<string, MetadataRoute.Sitemap[number]>();
    for (const row of rows) {
      if (row.published !== true || row.deleted_at || typeof row.id !== 'string' ||
          !/^[\p{L}\p{N}_-]{1,120}$/u.test(row.id)) continue;
      const code = typeof row.code === 'string' && /^CK-[A-Z0-9]+$/i.test(row.code) ? row.code : undefined;
      const url = propertyUrl({ id: row.id, code }, baseUrl);
      const modified = typeof row.updated_at === 'string' ? row.updated_at : row.created_at;
      const lastModified = typeof modified === 'string' && Number.isFinite(Date.parse(modified))
        ? new Date(modified).toISOString() : undefined;
      entries.set(url, { url, ...(lastModified ? { lastModified } : {}), changeFrequency: 'weekly', priority: 0.9 });
    }
    return [...staticPages, ...entries.values()];
  } catch {
    // Keep genuine public landing pages crawlable; never invent listing URLs.
    console.warn('SITEMAP_CATALOG_UNAVAILABLE');
    return staticPages;
  }
}
