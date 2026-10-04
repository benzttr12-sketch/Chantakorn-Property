'use client';

import { useEffect, useId, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, X } from 'lucide-react';

const LandValuationWorkbench = dynamic(() => import('@/components/landsmaps/AutoPinLandsMapsValuation'), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-gray-500" role="status">กำลังเปิดแผนที่และเครื่องมือประเมินราคา…</p>,
});

interface LandsMapsLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LandsMapsLookupModal({ isOpen, onClose }: LandsMapsLookupModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (document.fullscreenElement || dialogRef.current?.querySelector('[data-map-fullscreen="true"]')) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const fullscreenElement = document.fullscreenElement;
      const focusScope = fullscreenElement && dialogRef.current.contains(fullscreenElement)
        ? fullscreenElement : dialogRef.current.querySelector('[data-map-fullscreen="true"]') || dialogRef.current;
      const focusable = Array.from(focusScope.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !focusScope.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusScope.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-navy-950 p-4 text-white sm:p-5">
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 shrink-0 text-gold-400" aria-hidden="true" />
            <div>
              <h2 id={titleId} className="font-bold">ค้นที่ดิน & ประเมินราคา</h2>
              <p className="mt-1 text-xs text-gray-200">ดูตำแหน่งบนแผนที่ และค้นรูปแปลงหรือราคาประเมินผ่านเว็บไซต์ทางการ</p>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="ปิดหน้าค้นที่ดิน" className="rounded-xl p-2 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6">
          <LandValuationWorkbench />
        </div>
      </div>
    </div>
  );
}
