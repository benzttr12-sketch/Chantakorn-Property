'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

/** Draft media uses the staff SDK rather than making unpublished photos publicly accessible. */
export default function StaffPropertyImage({ src, propertyId, alt, className = 'object-cover' }: { src: string; propertyId: string; alt: string; className?: string }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    setImage('');
    let media: string | null = null;
    try {
      const url = new URL(src);
      if (url.pathname === `/api/properties/${encodeURIComponent(propertyId)}/image`) media = url.searchParams.get('media');
    } catch {}
    if (!db || !media || !/^[0-9a-f-]{36}$/i.test(media)) { setImage(src); return; }
    getDocFromServer(doc(db, 'property_media', media)).then(snapshot => {
      const photo = snapshot.data();
      if (active && photo?.property_id === propertyId && typeof photo.data_url === 'string') setImage(photo.data_url);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [src, propertyId]);
  return image ? <Image src={image} alt={alt} fill unoptimized referrerPolicy="no-referrer" className={className} /> : <span role="img" aria-label={alt} className="block h-full w-full bg-slate-100" />;
}
