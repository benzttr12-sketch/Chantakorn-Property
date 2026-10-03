import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import { getCachedPropertyImage } from '@/lib/property-image-cache';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return new NextResponse('Missing property ID', { status: 400 });
    }

    const decodedId = decodeURIComponent(id).trim();
    const { searchParams } = new URL(req.url);
    const indexParam = parseInt(searchParams.get('index') || '0', 10);
    const photoIndex = isNaN(indexParam) || indexParam < 0 ? 0 : indexParam;

    let targetImage: string | null = null;
    let propertyType: string | undefined;
    let propertyTitle: string | undefined;

    // 1. Check in-memory fast cache first
    const cached = getCachedPropertyImage(id) || getCachedPropertyImage(decodedId);
    if (cached) {
      targetImage = cached;
    }

    // 2. Query Firestore if not found in memory
    if (!targetImage && db) {
      try {
        // Try direct document ID
        const docRef = doc(db, 'properties', id);
        let snap = await getDoc(docRef);
        
        if (!snap.exists() && decodedId !== id) {
          snap = await getDoc(doc(db, 'properties', decodedId));
        }

        if (snap.exists()) {
          const data = snap.data();
          propertyType = data.property_type;
          propertyTitle = data.title;
          if (Array.isArray(data.images) && data.images.length > photoIndex && data.images[photoIndex]) {
            targetImage = data.images[photoIndex];
          } else if (data.cover_image) {
            targetImage = data.cover_image;
          }
        } else {
          // Try query by slug or title
          const propCollection = collection(db, 'properties');
          const qSlug = query(propCollection, where('slug', '==', id), limit(1));
          const slugSnap = await getDocs(qSlug);
          if (!slugSnap.empty) {
            const data = slugSnap.docs[0].data();
            propertyType = data.property_type;
            propertyTitle = data.title;
            if (Array.isArray(data.images) && data.images.length > photoIndex && data.images[photoIndex]) {
              targetImage = data.images[photoIndex];
            } else if (data.cover_image) {
              targetImage = data.cover_image;
            }
          } else if (decodedId !== id) {
            const qDecoded = query(propCollection, where('slug', '==', decodedId), limit(1));
            const decodedSnap = await getDocs(qDecoded);
            if (!decodedSnap.empty) {
              const data = decodedSnap.docs[0].data();
              propertyType = data.property_type;
              propertyTitle = data.title;
              if (Array.isArray(data.images) && data.images.length > photoIndex && data.images[photoIndex]) {
                targetImage = data.images[photoIndex];
              } else if (data.cover_image) {
                targetImage = data.cover_image;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Property Image API] Error reading Firestore:', err);
      }
    }

    // 3. Check SAMPLE_PROPERTIES if still not found
    if (!targetImage) {
      const matched = SAMPLE_PROPERTIES.find(
        (p) =>
          p.id === id ||
          p.id === decodedId ||
          p.slug === id ||
          p.slug === decodedId ||
          p.title?.toLowerCase() === decodedId.toLowerCase()
      );
      if (matched) {
        propertyType = matched.property_type;
        propertyTitle = matched.title;
        if (Array.isArray(matched.images) && matched.images.length > photoIndex && matched.images[photoIndex]) {
          targetImage = matched.images[photoIndex];
        } else if (matched.cover_image) {
          targetImage = matched.cover_image;
        }
      }
    }

    // 4. Default fallback image if no photo found
    if (!targetImage) {
      if (propertyType === 'land' || propertyTitle?.includes('ที่ดิน') || decodedId.includes('ที่ดิน') || decodedId.includes('singhanakhon') || decodedId.includes('สิงหนคร')) {
        targetImage = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80';
      } else {
        targetImage = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80';
      }
    }

    // A. If targetImage is a base64 Data URL
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

    // B. If targetImage is an HTTP / HTTPS URL, proxy fetch to ensure 200 OK for LINE Messaging API
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
        console.warn('[Property Image API] Remote fetch failed:', fetchErr);
      }
    }

    // C. Fallback proxy
    const fallbackUrl = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80';
    const fallbackRes = await fetch(fallbackUrl);
    const arrayBuffer = await fallbackRes.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    console.error('[Property Image API] Unexpected error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
