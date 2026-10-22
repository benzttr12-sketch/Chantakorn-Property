import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://chantakornproperty.com').replace(/\/$/, '');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const siteBase = /^https?:\/\/[^/]+$/.test(baseUrl) ? baseUrl + basePath : baseUrl;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [`${basePath}/admin/`, `${basePath}/api/`],
    },
    sitemap: `${siteBase}/sitemap.xml`,
  };
}
