'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { cloudflarePropertyPreviewUrl, fetchStaffPropertyPreview } from '@/lib/cloudflare-property-preview';

type Props = { src: string; propertyId?: string | null; alt: string; className?: string };
type Preview = { src: string; propertyId: string; url?: string; failed?: boolean };

/** Blob URLs are display-only; the editor continues to save the original R2 URL. */
export default function StaffPropertyImage({ src, propertyId, alt, className = 'object-cover' }: Props) {
  const cloudflare = (process.env.NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND || 'firebase').trim().toLowerCase() === 'cloudflare';
  const privatePreview = cloudflare &&
    !!propertyId && !!cloudflarePropertyPreviewUrl(src, propertyId);
  let firestoreMedia: string | null = null;
  if (!cloudflare && propertyId && db) {
    try {
      const url = new URL(src);
      const media = url.searchParams.get('media');
      if (url.pathname === `/api/properties/${encodeURIComponent(propertyId)}/image` && media && /^[0-9a-f-]{36}$/i.test(media))
        firestoreMedia = media;
    } catch {}
  }
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (!propertyId || (!privatePreview && !firestoreMedia)) return;
    const controller = new AbortController();
    let active = true;
    let objectUrl: string | undefined;
    const fail = () => {
      if (active) setPreview({ src, propertyId, failed: true });
    };
    if (privatePreview) {
      fetchStaffPropertyPreview(src, propertyId, controller.signal).then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ src, propertyId, url: objectUrl });
      }).catch(fail);
    } else if (db && firestoreMedia) {
      getDocFromServer(doc(db, 'property_media', firestoreMedia)).then(snapshot => {
        if (!active) return;
        const photo = snapshot.data();
        if (photo?.property_id === propertyId && typeof photo.data_url === 'string')
          setPreview({ src, propertyId, url: photo.data_url });
        else fail();
      }).catch(fail);
    }
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, propertyId, privatePreview, firestoreMedia]);

  const current = preview?.src === src && preview.propertyId === propertyId ? preview : null;
  const staffPreview = privatePreview || !!firestoreMedia;
  if (staffPreview && !current?.url) {
    return (
      <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-gray-600" role="status">
        {current?.failed ? 'โหลดรูปไม่สำเร็จ กรุณาโหลดหน้าใหม่' : 'กำลังโหลดรูป…'}
      </span>
    );
  }
  return <Image src={staffPreview ? current!.url! : src} alt={alt} fill unoptimized
    className={className} referrerPolicy="no-referrer" />;
}
