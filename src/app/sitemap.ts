import { MetadataRoute } from 'next';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://chantakornproperty.com').replace(/\/$/, '');

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

  const propertyPages = SAMPLE_PROPERTIES.map((prop) => ({
    url: `${baseUrl}/properties/${encodeURI(prop.slug)}`,
    lastModified: prop.updated_at || prop.created_at || new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [...staticPages, ...propertyPages];
}
