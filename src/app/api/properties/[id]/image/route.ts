import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return new NextResponse('Missing property ID', { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const indexParam = parseInt(searchParams.get('index') || '0', 10);
    const photoIndex = isNaN(indexParam) || indexParam < 0 ? 0 : indexParam;

    let targetImage: string | null = null;

    if (db) {
      try {
        const docRef = doc(db, 'properties', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.images) && data.images.length > photoIndex && data.images[photoIndex]) {
            targetImage = data.images[photoIndex];
          } else if (data.cover_image) {
            targetImage = data.cover_image;
          }
        }
      } catch (err) {
        console.warn('[Property Image API] Error reading Firestore:', err);
      }
    }

    if (!targetImage) {
      // Fallback redirect to public real estate image
      return NextResponse.redirect(
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
        302
      );
    }

    // 1. If it's a data URL (base64)
    if (targetImage.startsWith('data:')) {
      const match = targetImage.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1] || 'image/jpeg';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        return new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        });
      }
    }

    // 2. If it's a normal HTTP / HTTPS URL, proxy fetch and return 200 OK (LINE clients do not follow 302 redirects)
    if (/^https?:\/\//i.test(targetImage)) {
      try {
        const remoteRes = await fetch(targetImage);
        if (remoteRes.ok) {
          const contentType = remoteRes.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await remoteRes.arrayBuffer();
          return new Response(arrayBuffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            },
          });
        }
      } catch (fetchErr) {
        console.warn('[Property Image API] Remote fetch failed, using fallback:', fetchErr);
      }
    }

    // 3. Fallback high-resolution image proxy
    const fallbackUrl = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80';
    try {
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const arrayBuffer = await fallbackRes.arrayBuffer();
        return new Response(arrayBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.redirect(fallbackUrl, 302);
  } catch (err: any) {
    console.error('[Property Image API] Unexpected error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
