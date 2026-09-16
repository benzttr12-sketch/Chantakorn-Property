import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [`${basePath}/admin/`, `${basePath}/api/`],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
