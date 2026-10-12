import { NextRequest, NextResponse } from 'next/server';
import { parseGoogleMapsCoordinates, isValidLatLng } from '@/lib/utils';
import { readJsonBody } from '@/lib/server-request';

const GOOGLE_MAPS_HOSTS = new Set(['google.com', 'www.google.com', 'google.co.th', 'www.google.co.th']);
const GOOGLE_MAPS_SUBDOMAINS = new Set(['maps.google.com', 'maps.google.co.th']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function allowedMapsUrl(value: string, base?: URL): URL | null {
  try {
    // URL normalizes an explicit :443 away; reject explicit ports before that normalization.
    const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]+)/i)?.[1];
    if (authority && /:\d+$/.test(authority)) return null;
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const mapsPath = /^\/maps(?:\/|$)/.test(url.pathname);
    if (GOOGLE_MAPS_HOSTS.has(host) && mapsPath) return url;
    if (GOOGLE_MAPS_SUBDOMAINS.has(host) && (url.pathname === '/' || mapsPath)) return url;
    if (host === 'maps.app.goo.gl' && url.pathname !== '/') return url;
    if (host === 'goo.gl' && /^\/maps\/.+/.test(url.pathname)) return url;
    return null;
  } catch {
    return null;
  }
}

async function readGoogleHtml(response: Response): Promise<string | null> {
  if (Number(response.headers.get('content-length')) > MAX_HTML_BYTES) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const text: string[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) {
        await reader.cancel();
        return null;
      }
      text.push(decoder.decode(value, { stream: true }));
    }
    text.push(decoder.decode());
    return text.join('');
  } finally {
    reader.releaseLock();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonBody(req, 16 * 1024);
    if (body.error) return body.error;
    const url = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>).url : undefined;

    if (!url || typeof url !== 'string' || url.length > 10000) {
      return NextResponse.json({ error: 'กรุณาระบุ URL ของ Google Maps' }, { status: 400 });
    }

    const trimmed = url.trim();

    // 1. ตรวจสอบพิกัดแบบทันทีด้วย parseGoogleMapsCoordinates
    const directParsed = parseGoogleMapsCoordinates(trimmed);
    if (directParsed) {
      return NextResponse.json({
        success: true,
        lat: directParsed.lat,
        lng: directParsed.lng,
        sourceType: directParsed.sourceType,
      });
    }

    // 2. ตรวจสอบว่าเป็น URL ที่ถูกต้อง
    let targetUrl = allowedMapsUrl(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!targetUrl) {
      return NextResponse.json({ error: 'รองรับเฉพาะลิงก์ Google Maps เท่านั้น' }, { status: 400 });
    }

    // Each destination is validated before fetching; browser-style automatic redirects are unsafe here.
    const signal = AbortSignal.timeout(6000);
    let response: Response | undefined;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'th,en-US,en;q=0.9',
        },
        redirect: 'manual',
        signal,
      });
      if (!REDIRECT_STATUSES.has(response.status)) break;
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirects === MAX_REDIRECTS) {
        return NextResponse.json({ error: 'ไม่สามารถตรวจสอบปลายทางของลิงก์นี้ได้' }, { status: 422 });
      }
      const redirectedUrl = allowedMapsUrl(location, targetUrl);
      if (!redirectedUrl) {
        return NextResponse.json({ error: 'ปลายทางลิงก์ไม่ใช่ Google Maps ที่รองรับ' }, { status: 400 });
      }
      targetUrl = redirectedUrl;
    }

    const finalUrl = targetUrl.toString();

    // 4. ตรวจสอบพิกัดจาก URL ปลายทางหลัง Redirect
    const urlParsed = parseGoogleMapsCoordinates(finalUrl);
    if (urlParsed) {
      await response?.body?.cancel();
      return NextResponse.json({
        success: true,
        lat: urlParsed.lat,
        lng: urlParsed.lng,
        resolvedUrl: finalUrl,
        sourceType: 'resolved',
      });
    }

    // 5. หากใน URL ไม่มี ให้ค้นหาจากเนื้อหา HTML ของหน้าปลายทาง
    if (!response?.ok) {
      await response?.body?.cancel();
      return NextResponse.json({ error: 'ไม่สามารถอ่านพิกัดจากลิงก์นี้ได้' }, { status: 422 });
    }
    const html = await readGoogleHtml(response);
    if (html === null) {
      return NextResponse.json({ error: 'ข้อมูลแผนที่มีขนาดใหญ่เกินกำหนด กรุณาคัดลอกพิกัดตัวเลข' }, { status: 422 });
    }
    const htmlParsed = parseGoogleMapsCoordinates(html);
    if (htmlParsed) {
      return NextResponse.json({
        success: true,
        lat: htmlParsed.lat,
        lng: htmlParsed.lng,
        resolvedUrl: finalUrl,
        sourceType: 'resolved',
      });
    }

    // ค้นหาจาก staticmap หรือ meta og:image
    const staticMapMatch = html.match(/staticmap[^"]*center=(-?\d+(?:\.\d+)?)[,%20C]+(-?\d+(?:\.\d+)?)/i);
    if (staticMapMatch) {
      const lat = parseFloat(staticMapMatch[1]);
      const lng = parseFloat(staticMapMatch[2]);
      if (isValidLatLng(lat, lng)) {
        return NextResponse.json({
          success: true,
          lat,
          lng,
          resolvedUrl: finalUrl,
          sourceType: 'resolved',
        });
      }
    }

    // ค้นหาจาก APP_INITIALIZATION_STATE coordinates [null,null,lat,lng]
    const stateMatch = html.match(/\[null,null,(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/);
    if (stateMatch) {
      const lat = parseFloat(stateMatch[1]);
      const lng = parseFloat(stateMatch[2]);
      if (isValidLatLng(lat, lng)) {
        return NextResponse.json({
          success: true,
          lat,
          lng,
          resolvedUrl: finalUrl,
          sourceType: 'resolved',
        });
      }
    }

    return NextResponse.json({
      error: 'ไม่พบพิกัดในลิงก์นี้ กรุณาคัดลอกพิกัดตัวเลข (เช่น 7.0084, 100.4747) หรือลิงก์ที่มีพิกัดจากเบราว์เซอร์',
    }, { status: 422 });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบลิงก์ Google Maps กรุณาลองใหม่' }, { status: 500 });
  }
}
