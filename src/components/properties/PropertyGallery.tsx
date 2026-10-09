'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Images, Share2, Heart, ChevronLeft, ChevronRight, X, Check, Film, ZoomIn, ZoomOut } from 'lucide-react';
import { toggleFavoriteId, getFavoriteIds } from '@/lib/store/properties-store';
import { isGalleryTypingTarget, swipeImageDelta, wrapImageIndex } from '@/lib/gallery-navigation';

interface PropertyGalleryProps { id: string; title: string; images: string[]; videoUrl?: string }
type Gesture = { x: number; y: number; pointerId: number; left: number; top: number; pan: boolean };

export default function PropertyGallery({ id, title, images, videoUrl }: PropertyGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState(false);
  const [shareError, setShareError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const viewerThumbnailsRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const swipedRef = useRef(false);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoList = (images || []).filter(image => typeof image === 'string' && image.trim());
  const total = photoList.length;
  const activeIndex = Math.min(selectedIndex, Math.max(0, total - 1));
  const photo = photoList[activeIndex];

  useEffect(() => {
    const update = () => setIsFavorite(getFavoriteIds().includes(id));
    update();
    window.addEventListener('favorites-updated', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('favorites-updated', update); window.removeEventListener('storage', update); };
  }, [id]);
  useEffect(() => { setSelectedIndex(0); setZoomed(false); setLightboxOpen(false); }, [id]);
  useEffect(() => {
    setSelectedIndex(index => Math.min(index, Math.max(0, total - 1)));
    if (!total) setLightboxOpen(false);
  }, [total]);
  useEffect(() => () => { if (shareTimerRef.current) clearTimeout(shareTimerRef.current); }, []);

  const changeImage = useCallback((delta: number) => {
    setSelectedIndex(index => wrapImageIndex(index + delta, total));
    setZoomed(false);
  }, [total]);

  useEffect(() => {
    // Scroll each thumbnail rail without moving the page behind the viewer.
    for (const rail of [thumbnailsRef.current, viewerThumbnailsRef.current]) {
      const thumb = rail?.querySelector<HTMLButtonElement>(`[data-photo-index="${activeIndex}"]`);
      if (rail && thumb) rail.scrollTo({ left: Math.max(0, thumb.offsetLeft - (rail.clientWidth - thumb.offsetWidth) / 2), behavior: 'auto' });
    }
  }, [activeIndex, lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setLightboxOpen(false); return; }
      if (isGalleryTypingTarget(event.target as HTMLElement | null)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); changeImage(event.key === 'ArrowRight' ? 1 : -1);
      }
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [lightboxOpen, changeImage]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: zoomed ? (viewport.scrollWidth - viewport.clientWidth) / 2 : 0, top: zoomed ? (viewport.scrollHeight - viewport.clientHeight) / 2 : 0, behavior: 'auto' });
  }, [zoomed, activeIndex, lightboxOpen]);

  async function handleShare() {
    setShareError('');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch { setShareError('คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกจากแถบที่อยู่ของเบราว์เซอร์'); }
  }

  function beginGesture(event: React.PointerEvent<HTMLDivElement>) {
    swipedRef.current = false;
    if (!event.isPrimary) { gestureRef.current = null; return; }
    if ((event.target as HTMLElement).closest('[data-gallery-control]')) return;
    const pan = lightboxOpen && zoomed;
    if (!pan && event.pointerType !== 'touch') return;
    if (pan && event.pointerType === 'mouse' && event.button !== 0) return;
    gestureRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, pan };
    if (pan) event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveGesture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !gesture.pan) return;
    event.currentTarget.scrollLeft = gesture.left - (event.clientX - gesture.x);
    event.currentTarget.scrollTop = gesture.top - (event.clientY - gesture.y);
  }

  function endGesture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture.pan && total > 1) {
      const delta = swipeImageDelta(gesture, { x: event.clientX, y: event.clientY });
      if (delta) { swipedRef.current = !lightboxOpen; changeImage(delta); }
    }
  }

  const controls = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2';
  const gestures = { onPointerDown: beginGesture, onPointerMove: moveGesture, onPointerUp: endGesture, onPointerCancel: () => { gestureRef.current = null; } };
  function choosePhoto(index: number) { setSelectedIndex(index); setZoomed(false); }

  return (
    <div className="space-y-3" id="property-gallery">
      {shareError && <p role="alert" className="text-sm text-red-700">{shareError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <span className="text-xs font-semibold text-gray-500">{total ? `ภาพถ่ายสถานที่จริง (${total} รูป)` : 'ภาพประกอบทรัพย์'}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleShare} className={`flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-surface-border text-navy-900 text-xs font-semibold rounded-xl shadow-sm ${controls}`} title="คัดลอกลิงก์เพื่อแชร์">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}<span role={copied ? 'status' : undefined}>{copied ? 'คัดลอกลิงก์แล้ว' : 'แชร์'}</span>
          </button>
          <button type="button" aria-pressed={isFavorite} onClick={() => { const value = toggleFavoriteId(id); setIsFavorite(value); setFavoriteFeedback(value); }} className={`flex items-center gap-1.5 px-3 py-2 border text-xs font-semibold rounded-xl shadow-sm ${controls} ${isFavorite ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white hover:bg-gray-50 text-navy-900 border-surface-border'}`}>
            <span className={`inline-flex ${favoriteFeedback ? 'favorite-pop' : ''}`} onAnimationEnd={() => setFavoriteFeedback(false)}><Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} /></span><span>{isFavorite ? 'บันทึกแล้ว' : 'บันทึก'}</span>
          </button>
          {videoUrl && <button type="button" onClick={() => document.getElementById('video-tour-section')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} className={`flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl ${controls}`}><Film className="w-3.5 h-3.5" />วิดีโอพาทัวร์</button>}
          <button type="button" disabled={!total} onClick={() => setLightboxOpen(true)} className={`flex items-center gap-1.5 px-3 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-semibold rounded-xl disabled:opacity-40 ${controls}`}><Images className="w-3.5 h-3.5" />ดูรูปทั้งหมด ({total})</button>
        </div>
      </div>

      <div {...gestures} style={{ touchAction: 'pan-y' }} className="relative aspect-[16/9] md:aspect-[21/9] w-full rounded-2xl overflow-hidden bg-navy-900 shadow-card group">
        {photo ? <button type="button" className={`absolute inset-0 w-full h-full ${controls}`} aria-label={`เปิดภาพ ${activeIndex + 1} แบบเต็มจอ`} onClick={() => { if (swipedRef.current) { swipedRef.current = false; return; } setLightboxOpen(true); }}>
          <Image key={photo} src={photo} alt={`${title} - รูปที่ ${activeIndex + 1}`} fill priority unoptimized={photo.startsWith('data:')} className="object-cover gallery-image-enter motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.025]" draggable={false} />
        </button> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300"><Images className="w-10 h-10" /><p className="text-sm">ยังไม่มีภาพทรัพย์</p></div>}
        {total > 1 && <>
          <button type="button" data-gallery-control aria-label="ภาพก่อนหน้า" onClick={() => changeImage(-1)} className={`absolute z-10 left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm ${controls}`}><ChevronLeft className="w-6 h-6" /></button>
          <button type="button" data-gallery-control aria-label="ภาพถัดไป" onClick={() => changeImage(1)} className={`absolute z-10 right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm ${controls}`}><ChevronRight className="w-6 h-6" /></button>
        </>}
        {!!total && <div className="absolute bottom-3 right-3 pointer-events-none px-3 py-1.5 bg-navy-950/80 backdrop-blur-md rounded-lg text-xs font-bold text-white border border-white/10">{activeIndex + 1} / {total}</div>}
      </div>
      {total > 1 && <div ref={thumbnailsRef} className="relative flex gap-2.5 overflow-x-auto py-1 no-scrollbar" aria-label="เลือกภาพทรัพย์">
        {photoList.map((image, index) => <button type="button" key={`${id}-${index}`} data-photo-index={index} aria-label={`ดูภาพที่ ${index + 1}`} aria-pressed={activeIndex === index} onClick={() => choosePhoto(index)} className={`relative w-24 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden shrink-0 ${controls} ${activeIndex === index ? 'ring-2 ring-gold-500 opacity-100' : 'opacity-60 hover:opacity-100'}`}><Image src={image} alt="" fill unoptimized={image.startsWith('data:')} className="object-cover" /></button>)}
      </div>}
      {total > 1 && <p className="text-[11px] text-gray-500 sm:hidden">ปัดภาพไปทางซ้ายหรือขวาเพื่อดูรูปถัดไป</p>}

      {lightboxOpen && photo && createPortal(
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="gallery-viewer-title" className="fixed inset-0 z-[110] bg-navy-950/95 backdrop-blur-md flex flex-col p-3 sm:p-6 gap-3 gallery-image-enter">
          <div className="flex shrink-0 items-center justify-between gap-3 text-white">
            <div className="min-w-0"><h2 id="gallery-viewer-title" className="font-semibold text-sm sm:text-base truncate">{title}</h2><p className="text-xs text-gold-400 mt-1" role="status" aria-live="polite">ภาพที่ {activeIndex + 1} จาก {total}</p></div>
            <div className="flex gap-2 shrink-0">
              <button type="button" aria-label={zoomed ? 'ย่อภาพให้พอดีจอ' : 'ขยายภาพ 2 เท่า'} aria-pressed={zoomed} onClick={() => setZoomed(value => !value)} className={`p-3 rounded-full bg-white/10 hover:bg-white/20 text-white ${controls}`}>{zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}</button>
              <button type="button" ref={closeRef} aria-label="ปิดตัวดูรูป" onClick={() => setLightboxOpen(false)} className={`p-3 rounded-full bg-white/10 hover:bg-white/20 text-white ${controls}`}><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            <div ref={viewportRef} {...gestures} style={{ touchAction: zoomed ? 'none' : 'pan-y' }} className={`absolute inset-0 overflow-auto rounded-2xl ${zoomed ? 'cursor-grab active:cursor-grabbing' : ''}`}>
              <div className="relative" style={{ width: zoomed ? '200%' : '100%', height: zoomed ? '200%' : '100%' }}>
                <Image key={photo} src={photo} alt={`${title} - รูปที่ ${activeIndex + 1}`} fill unoptimized={photo.startsWith('data:')} className="object-contain gallery-image-enter select-none" draggable={false} />
              </div>
            </div>
            {!zoomed && total > 1 && <>
              <button type="button" aria-label="ภาพก่อนหน้า" onClick={() => changeImage(-1)} className={`absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center ${controls}`}><ChevronLeft className="w-6 h-6" /></button>
              <button type="button" aria-label="ภาพถัดไป" onClick={() => changeImage(1)} className={`absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center ${controls}`}><ChevronRight className="w-6 h-6" /></button>
            </>}
          </div>
          <p className="shrink-0 text-center text-xs text-slate-300">{zoomed ? 'ลากภาพเพื่อดูรายละเอียด · กดปุ่มย่อเพื่อดูภาพเต็ม' : 'ปัดเพื่อเปลี่ยนรูป · ใช้ปุ่มลูกศรบนคีย์บอร์ด · กด Esc เพื่อปิด'}</p>
          {total > 1 && <div ref={viewerThumbnailsRef} className="relative shrink-0 flex gap-2 overflow-x-auto mx-auto max-w-full p-1 no-scrollbar" aria-label="เลือกภาพในตัวดูรูป">
            {photoList.map((image, index) => <button type="button" key={index} data-photo-index={index} aria-label={`ดูภาพที่ ${index + 1}`} aria-pressed={activeIndex === index} onClick={() => choosePhoto(index)} className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden shrink-0 ${controls} ${activeIndex === index ? 'ring-2 ring-gold-400' : 'opacity-50 hover:opacity-100'}`}><Image src={image} alt="" fill unoptimized={image.startsWith('data:')} className="object-cover" /></button>)}
          </div>}
        </div>, document.body,
      )}
    </div>
  );
}
