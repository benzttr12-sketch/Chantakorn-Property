'use client';
import { useState } from 'react';
import Image from 'next/image';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
export default function InquiryPhotos({ inquiryId, photos }: { inquiryId: string; photos: string[] }) {
  const [images, setImages] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function show() {
    if (open) { setOpen(false); return; }
    if (images.length) { setOpen(true); return; }
    setLoading(true); setError('');
    try {
      const result = await Promise.all(photos.slice(0, 15).map(async photo => {
        if (photo.startsWith('data:image/') || photo.startsWith('https://')) return photo;
        if (!db || !/^[0-9a-f-]{36}$/i.test(photo)) throw new Error('ไม่พบรูป');
        const record = (await getDocFromServer(doc(db, 'inquiry_media', photo))).data();
        if (record?.inquiry_id !== inquiryId || typeof record.data_url !== 'string') throw new Error('ไม่พบรูป');
        return record.data_url;
      }));
      setImages(result); setOpen(true);
    } catch { setError('โหลดรูปไม่สำเร็จ กรุณาลองใหม่'); }
    finally { setLoading(false); }
  }
  if (!photos.length) return null;
  return <div className="mt-4">
    <button type="button" onClick={show} disabled={loading} aria-expanded={open} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-navy-950 hover:bg-slate-50 disabled:opacity-50">{loading ? 'กำลังโหลดรูป…' : open ? 'ซ่อนรูป' : `ดูรูปที่แนบ (${photos.length})`}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {open && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{images.map((src, index) => <a key={index} href={src} target="_blank" rel="noreferrer" aria-label={`ดูรูปที่ ${index + 1}`} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100"><Image src={src} alt={`รูปที่ลูกค้าแนบ ${index + 1}`} fill unoptimized className="object-cover" /></a>)}</div>}
  </div>;
}
