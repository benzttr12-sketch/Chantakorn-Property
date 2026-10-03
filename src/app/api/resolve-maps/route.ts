import { NextRequest, NextResponse } from 'next/server';
import { parseGoogleMapsCoordinates, isValidLatLng } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
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
    let targetUrl: URL;
    try {
      targetUrl = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      return NextResponse.json({ error: 'URL ไม่ถูกต้อง' }, { status: 400 });
    }

    // ตรวจสอบโดเมน Google
    const hostname = targetUrl.hostname.toLowerCase();
    const isGoogle = hostname.includes('google') || hostname.includes('goo.gl');
    if (!isGoogle) {
      return NextResponse.json({ error: 'รองรับเฉพาะลิงก์ Google Maps เท่านั้น' }, { status: 400 });
    }

    // 3. ยิง HTTP GET เพื่อตาม Redirect ไปยัง URL ปลายทางที่มีพิกัดจริง
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'th,en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });

    const finalUrl = response.url || '';

    // 4. ตรวจสอบพิกัดจาก URL ปลายทางหลัง Redirect
    const urlParsed = parseGoogleMapsCoordinates(finalUrl);
    if (urlParsed) {
      return NextResponse.json({
        success: true,
        lat: urlParsed.lat,
        lng: urlParsed.lng,
        resolvedUrl: finalUrl,
        sourceType: 'resolved',
      });
    }

    // 5. หากใน URL ไม่มี ให้ค้นหาจากเนื้อหา HTML ของหน้าปลายทาง
    const html = await response.text();
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตรวจสอบลิงก์ Google Maps';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
