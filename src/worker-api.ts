import * as automate from './app/api/ai/automate/route';
import * as faq from './app/api/ai/faq/route';
import * as generateDescription from './app/api/ai/generate-property-description/route';
import * as marketIntelligence from './app/api/ai/market-intelligence/route';
import * as propertyMediaStudio from './app/api/ai/property-media-studio/route';
import * as landsmaps from './app/api/landsmaps/route';
import * as lineNotify from './app/api/line/notify/route';
import * as lineWebhook from './app/api/line/webhook/route';
import * as resolveMaps from './app/api/resolve-maps/route';

type Handler = (request: Request) => Promise<Response>;

const routes: Record<string, Partial<Record<string, Handler>>> = {
  '/api/ai/automate': { POST: automate.POST },
  '/api/ai/faq': { GET: faq.GET, POST: faq.POST },
  '/api/ai/generate-property-description': { POST: generateDescription.POST },
  '/api/ai/market-intelligence': { POST: marketIntelligence.POST },
  '/api/ai/property-media-studio': { POST: propertyMediaStudio.POST },
  '/api/landsmaps': { GET: landsmaps.GET, POST: landsmaps.POST },
  '/api/line/notify': { GET: lineNotify.GET, POST: lineNotify.POST },
  '/api/line/webhook': { GET: lineWebhook.GET, POST: lineWebhook.POST },
  '/api/resolve-maps': { POST: resolveMaps.POST },
};

function allowedOrigins(): Set<string> {
  return new Set(
    (process.env.ALLOWED_ORIGINS || 'https://benzttr12-sketch.github.io')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function addCorsHeaders(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  headers.append('Vary', 'Origin');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Line-Signature, X-Line-Simulation');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const apiWorker = {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed = allowedOrigins();
    if (origin && !allowed.has(origin)) {
      return Response.json({ error: 'Origin is not allowed' }, { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return addCorsHeaders(new Response(null, { status: 204 }), origin);
    }

    const route = routes[new URL(request.url).pathname];
    const handler = route?.[request.method];
    if (!handler) {
      const response = Response.json(
        { error: route ? 'Method not allowed' : 'API route not found' },
        { status: route ? 405 : 404, headers: route ? { Allow: Object.keys(route).join(', ') } : undefined }
      );
      return addCorsHeaders(response, origin);
    }

    try {
      return addCorsHeaders(await handler(request), origin);
    } catch (error) {
      console.error('Unhandled API worker error:', error);
      return addCorsHeaders(Response.json({ error: 'Internal server error' }, { status: 500 }), origin);
    }
  },
};

export default apiWorker;
