import { MetadataRoute } from 'next';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

  const staticPages = [
    '',
    '/properties',
    '/buy',
    '/rent',
    '/sell',
    '/services',
    '/about',
    '/contact',
    '/favorites',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  const propertyPages = (process.env.NEXT_PUBLIC_DATA_BACKEND === 'local' ? SAMPLE_PROPERTIES : []).map((prop) => ({
    url: `${baseUrl}/properties/${prop.slug}`,
    lastModified: prop.updated_at || prop.created_at,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [...staticPages, ...propertyPages];
}
