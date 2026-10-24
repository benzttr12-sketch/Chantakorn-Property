const staticExport = process.env.STATIC_EXPORT === 'true';

const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').trim();
// If it is a known test placeholder (such as 51895189zaza) or empty, default to root path ''
const isPlaceholder = !rawBasePath || rawBasePath === '51895189zaza' || rawBasePath.includes('YOUR_') || rawBasePath.includes('your-');
const cleanBasePath = isPlaceholder ? '' : rawBasePath;

const normalizedBasePath = cleanBasePath
  ? (cleanBasePath.startsWith('/') ? cleanBasePath : `/${cleanBasePath}`).replace(/\/+$/, '')
  : '';

// Static export has no server runtime, so /_next/image cannot resize there.
// Server deployments keep the optimizer ON: multi-MB phone photos are resized
// and re-encoded (WebP/AVIF) before reaching clients.
const remotePatterns = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: 'images.pexels.com' },
  { protocol: 'https', hostname: '*.googleusercontent.com' },
  { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
  { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
  { protocol: 'https', hostname: '*.firebasestorage.app' },
  { protocol: 'https', hostname: 'picsum.photos' },
  { protocol: 'https', hostname: '*.workers.dev' },
];

const csp = [
  "default-src 'self'",
  // Next.js hydration + the Google Maps loader require inline script; Maps needs eval.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.firebaseio.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://maps.gstatic.com https://*.googleapis.com ${remotePatterns.map((p) => `https://${p.hostname}`).join(' ')}`,
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasestorage.app https://*.firebaseapp.com https://*.workers.dev https://api.line.me",
  // Video tours embed YouTube (privacy-enhanced domain); the map embeds Google Maps;
  // Firebase Auth completes the Google popup through a *.firebaseapp.com iframe.
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://maps.google.com https://*.firebaseapp.com",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: staticExport ? '.next-pages' : '.next',
  ...(staticExport ? { output: 'export', trailingSlash: true } : {}),
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  async headers() {
    // headers() is ignored by `output: export`; these apply to server deployments only.
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  devIndicators: false,
  experimental: {
    devtoolSegmentExplorer: false,
  },
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: normalizedBasePath,
    NEXT_PUBLIC_STATIC_EXPORT: staticExport ? 'true' : 'false',
    NEXT_PUBLIC_DATA_BACKEND: process.env.NEXT_PUBLIC_DATA_BACKEND || 'firebase',
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '',
  },
  images: {
    unoptimized: staticExport,
    remotePatterns,
  },
};

export default nextConfig;
