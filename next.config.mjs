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

// Satellite and Street View hosts from developers.google.com/maps/domains.
// Keep these separate from executable sources and the image optimizer.
const googleMapsTileSources = [
  'khmdb0.google.com', 'khmdb1.google.com',
  'khm.google.com', 'khm0.google.com', 'khm1.google.com',
  'khms0.google.com', 'khms1.google.com', 'khms2.google.com', 'khms3.google.com',
  'cbks0.google.com', 'cbks1.google.com', 'cbks2.google.com', 'cbks3.google.com',
].map(host => `https://${host}`).join(' ');

const csp = [
  "default-src 'self'",
  // Next.js hydration + the Google Maps loader require inline script; Maps needs eval.
  // Firebase Google Sign-In loads its iframe resolver through apis.google.com.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://*.firebaseio.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Leaflet uses direct image tiles for the admin/parcel maps.
  `img-src 'self' data: blob: https://maps.gstatic.com https://*.googleapis.com https://*.ggpht.com ${googleMapsTileSources} https://*.tile.openstreetmap.org https://server.arcgisonline.com https://lh3.googleusercontent.com ${remotePatterns.map((p) => `https://${p.hostname}`).join(' ')}`,
  `connect-src 'self' https://*.googleapis.com https://maps.gstatic.com https://csi.gstatic.com ${googleMapsTileSources} https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasestorage.app https://*.firebaseapp.com https://*.workers.dev https://api.line.me`,
  // Video tours embed YouTube (privacy-enhanced domain); the map embeds Google Maps;
  // Firebase Auth completes the Google popup through a same-origin or Firebase iframe.
  // maps.google.com embeds redirect to www.google.com/maps/embed.
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://maps.google.com https://www.google.com https://www.openstreetmap.org https://*.firebaseapp.com",
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
    return [
      { source: '/:path*', headers: securityHeaders },
      // Firebase's proxied OAuth helper navigates to Google and back. Giving
      // that helper the app's COOP can sever its opener before it can finish
      // the popup handshake. Match Firebase Hosting's default on this path;
      // keep every other header and the app's popup-compatible COOP intact.
      ...['/__/auth', '/__/auth/:path*'].map(source => ({
        source,
        headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' }],
      })),
    ];
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
    // Cutover (2026-10-25): the property catalog now defaults to Cloudflare
    // D1/R2. A Vercel/dashboard env var still overrides either value, so
    // rollback = setting NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=firebase there
    // (or reverting these defaults) and redeploying.
    NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND || 'cloudflare',
    NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: process.env.NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN
      || 'https://chantakorn-property-api.chantakorn-property.workers.dev',
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '',
  },
  images: {
    unoptimized: staticExport,
    remotePatterns,
  },
};

export default nextConfig;
