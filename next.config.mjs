const staticExport = process.env.STATIC_EXPORT === 'true';

const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim();
// If it is a known test placeholder (such as 51895189zaza) or empty, default to root path ''
const isPlaceholder = !rawBasePath || rawBasePath === '51895189zaza' || rawBasePath.includes('YOUR_') || rawBasePath.includes('your-');
const cleanBasePath = isPlaceholder ? '' : rawBasePath;

const normalizedBasePath = cleanBasePath
  ? (cleanBasePath.startsWith('/') ? cleanBasePath : `/${cleanBasePath}`).replace(/\/+$/, '')
  : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: staticExport ? '.next-pages' : '.next',
  experimental: {
    devtoolSegmentExplorer: false,
  },
  ...(staticExport ? { output: 'export', trailingSlash: true } : {}),
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  poweredByHeader: false,
  images: {
    unoptimized: staticExport,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      }
    ],
  },
};

export default nextConfig;
