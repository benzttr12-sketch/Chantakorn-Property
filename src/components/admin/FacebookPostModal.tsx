'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, Facebook, X } from 'lucide-react';
import { Property } from '@/lib/types';
import { generateLocalSocialPost, MarketingTone } from '@/lib/automation-engine';
import { DEFAULT_OFFICIAL_FACEBOOK, formatPrice, formatPropertyCode, getPropertyTypeName } from '@/lib/utils';
import StaffPropertyImage from '@/components/admin/StaffPropertyImage';

const TONES: { value: MarketingTone; label: string }[] = [
  { value: 'hot_deal', label: '📋 เน้นข้อมูล' },
  { value: 'luxury', label: '💎 เรียบหรู' },
  { value: 'friendly', label: '🏡 เป็นกันเอง' },
  { value: 'investor', label: '📈 นักลงทุน' },
];

/**
 * Prepare a Facebook page post: generates a ready-to-paste post from the
 * property data (same offline engine as the marketing toolbox), lets the
 * staff copy it and opens the official page. Nothing is sent automatically,
 * so the page admin stays in control of every publish.
 */
export default function FacebookPostModal({ isOpen, property, onClose }: {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [tone, setTone] = useState<MarketingTone>('hot_deal');
  const [edited, setEdited] = useState<{ source: string; text: string } | null>(null);
  const [copyResult, setCopyResult] = useState<{ key: string; ok: boolean } | null>(null);
  const activeRef = useRef(false);
  const copyAttempt = useRef(0);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    activeRef.current = true;
    copyAttempt.current += 1;
    return () => { activeRef.current = false; copyAttempt.current += 1; };
  }, [isOpen, property?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const post = useMemo(
    () => (isOpen && property ? generateLocalSocialPost(property, 'facebook', tone) : null),
    [isOpen, property, tone],
  );
  const source = `${property?.id || ''}:${tone}:${post?.fullPost || ''}`;
  const content = edited?.source === source ? edited.text : post?.fullPost || '';
  const copyKey = `${source}\u0000${content}`;
  const copied = copyResult?.key === copyKey && copyResult.ok;
  const copyFailed = copyResult?.key === copyKey && !copyResult.ok;
  const photos = property ? [...new Set([property.cover_image, ...(property.images || [])]
    .filter((photo): photo is string => typeof photo === 'string' && photo.trim().length > 0))] : [];

  if (!isOpen || !mounted || !property) return null;

  const handleCopy = async () => {
    const attempt = ++copyAttempt.current;
    try {
      await navigator.clipboard.writeText(content);
      if (activeRef.current && attempt === copyAttempt.current) setCopyResult({ key: copyKey, ok: true });
    } catch {
      if (!activeRef.current || attempt !== copyAttempt.current) return;
      setCopyResult({ key: copyKey, ok: false });
      textRef.current?.focus();
      textRef.current?.select();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 p-4 flex items-center justify-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="facebook-post-title"
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="bg-[#1877F2] text-white p-5 flex justify-between items-start">
          <div>
            <h2 id="facebook-post-title" className="font-extrabold text-lg flex items-center gap-2">
              <Facebook className="w-5 h-5" />
              เตรียมโพสต์ทรัพย์ลง Facebook
            </h2>
            <p className="text-sm mt-1 opacity-90">ตรวจรูปและรายละเอียดก่อนคัดลอกไปวางบนเพจ</p>
          </div>
          <button type="button" aria-label="ปิดหน้าต่างโพสต์ Facebook" onClick={onClose} className="p-2 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-navy-950 truncate">{property.title}</p>
            <p className="text-sm font-bold text-navy-950 mt-1">{formatPropertyCode(property.id)} · {getPropertyTypeName(property.property_type)} · {formatPrice(property.price, property.status)}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {property.status === 'rent' ? 'ให้เช่า' : 'ขาย'} · {property.district}, {property.province}
              {property.published ? '' : ' · ⚠️ ยังไม่เผยแพร่ (ลิงก์ในโพสต์ยังไม่เห็นสาธารณะ)'}
            </p>
          </div>

          {photos.length > 0 ? <div className="space-y-2">
            <p className="text-xs font-bold text-navy-950">รูปทรัพย์ที่เลือก · {photos.length} รูป</p>
            <ul aria-label="รูปทรัพย์สำหรับโพสต์" className="grid grid-cols-3 gap-2">
              {photos.slice(0, 6).map((photo, index) => <li key={photo}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <StaffPropertyImage src={photo} propertyId={property.id} alt={`${property.title} — ${index === 0 ? 'รูปปก' : `รูปที่ ${index + 1}`}`} className="object-contain" />
                </div>
                <p className="mt-1 text-center text-[11px] text-slate-500">{index === 0 ? 'รูปปกสำหรับลิงก์' : `รูปที่ ${index + 1}`}</p>
              </li>)}
            </ul>
            <p className="text-[11px] text-slate-500">การคัดลอกข้อความไม่แนบไฟล์รูป หากโพสต์รูปให้แนบรูปของทรัพย์นี้ใน Facebook ด้วย</p>
          </div> : <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">ทรัพย์นี้ยังไม่มีรูป กรุณาเพิ่มรูปในหน้าจัดการทรัพย์ก่อนโพสต์</p>}

          <div className="space-y-2">
            <span className="text-xs font-bold text-navy-950">เลือกโทนโพสต์:</span>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  aria-pressed={tone === t.value}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    tone === t.value
                      ? 'bg-navy-950 text-gold-400 shadow-md'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-gold-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <label htmlFor="facebook-post-content" className="block text-xs font-bold text-navy-950">ข้อความโพสต์ · แก้ไขได้ก่อนคัดลอก</label>
          <textarea
            id="facebook-post-content"
            ref={textRef}
            value={content}
            onChange={event => setEdited({ source, text: event.target.value })}
            rows={14}
            className="w-full p-4 rounded-2xl border border-slate-200 text-xs leading-relaxed text-slate-700 bg-slate-50 font-medium"
          />

          {post && post.hashtags.length > 0 && (
            <p className="text-[11px] text-gray-400">ตรวจราคา พื้นที่ และช่องทางติดต่อก่อนโพสต์</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-bold text-navy-950 hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'คัดลอกแล้ว! วางบนเพจได้เลย' : 'คัดลอกข้อความโพสต์'}
            </button>
            <a
              href={DEFAULT_OFFICIAL_FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-[2] py-3 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              เปิด Facebook เพจเพื่อโพสต์
            </a>
          </div>
          {copyFailed && <p role="alert" className="text-xs text-red-700">คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้ให้แล้ว กรุณากด Ctrl+C หรือคัดลอกจากเมนูของอุปกรณ์</p>}
          <p className="text-[11px] text-gray-500">เปิด Facebook วางข้อความ ตรวจรูปและรายละเอียด แล้วกดเผยแพร่บนเพจ</p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
