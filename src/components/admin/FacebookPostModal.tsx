'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, Facebook, Loader2, RefreshCw, X } from 'lucide-react';
import { Property } from '@/lib/types';
import { generateLocalSocialPost, MarketingTone } from '@/lib/automation-engine';
import { DEFAULT_OFFICIAL_FACEBOOK } from '@/lib/utils';

const TONES: { value: MarketingTone; label: string }[] = [
  { value: 'hot_deal', label: '🔥 ดีลด่วน' },
  { value: 'luxury', label: '💎 พรีเมียม' },
  { value: 'friendly', label: '🏡 เป็นกันเอง' },
  { value: 'investor', label: '📈 นักลงทุน' },
];

/**
 * One-click Facebook page post: generates a ready-to-paste post from the
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
  const [copied, setCopied] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  if (!isOpen || !mounted || !property) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(post?.fullPost || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable: the textarea stays selectable */ }
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
              โพสต์ทรัพย์ลง Facebook เพจ
            </h2>
            <p className="text-sm mt-1 opacity-90">ข้อความพร้อมโพสต์ สำเนาแล้ววางบนเพจของคุณ</p>
          </div>
          <button type="button" aria-label="ปิดหน้าต่างโพสต์ Facebook" onClick={onClose} className="p-2 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-navy-950 truncate">{property.title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {property.status === 'rent' ? 'ให้เช่า' : 'ขาย'} · {property.district}, {property.province}
              {property.published ? '' : ' · ⚠️ ยังไม่เผยแพร่ (ลิงก์ในโพสต์ยังไม่เห็นสาธารณะ)'}
            </p>
          </div>

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

          <textarea
            value={post?.fullPost || ''}
            onChange={() => undefined}
            rows={14}
            readOnly
            className="w-full p-4 rounded-2xl border border-slate-200 text-xs leading-relaxed text-slate-700 bg-slate-50 font-medium"
          />

          {post && post.hashtags.length > 0 && (
            <p className="text-[11px] text-gray-400">แฮชแท็กแนะนำแนบในข้อความแล้ว — แก้ไขเพิ่มเติมได้หลังคัดลอก</p>
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
          <p className="text-[11px] text-gray-400 flex gap-1 items-center">
            <Loader2 className="w-3 h-3 opacity-0" />
            Facebook ไม่อนุญาตให้เว็บภายนอกโพสต์แทนคุณอัตโนมัติ ขั้นตอนจึงเป็น &ldquo;คัดลอก → วาง → โพสต์&rdquo; เพื่อความปลอดภัยของเพจคุณ
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
