'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Images, 
  Share2, 
  Heart, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Check
} from 'lucide-react';
import { toggleFavoriteId, getFavoriteIds } from '@/lib/store/properties-store';

interface PropertyGalleryProps {
  id: string;
  title: string;
  images: string[];
}

export default function PropertyGallery({ id, title, images }: PropertyGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareError, setShareError] = useState('');
  useEffect(() => {
    const update = () => setIsFavorite(getFavoriteIds().includes(id));
    update();
    window.addEventListener('favorites-updated', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('favorites-updated', update); window.removeEventListener('storage', update); };
  }, [id]);

  const photoList = images && images.length > 0 ? images : [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
  ];

  const handleShare = async () => {
    setShareError('');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareError('คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกจากแถบที่อยู่ของเบราว์เซอร์');
    }
  };

  const handleToggleFav = () => {
    const newState = toggleFavoriteId(id);
    setIsFavorite(newState);
  };

  const nextImage = () => {
    setSelectedIndex((prev) => (prev + 1) % photoList.length);
  };

  const prevImage = () => {
    setSelectedIndex((prev) => (prev - 1 + photoList.length) % photoList.length);
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'ArrowRight') setSelectedIndex(index => (index + 1) % photoList.length);
      if (event.key === 'ArrowLeft') setSelectedIndex(index => (index - 1 + photoList.length) % photoList.length);
    };
    window.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleKey); };
  }, [lightboxOpen, photoList.length]);

  return (
    <div className="space-y-3">
      {shareError && <p role="alert" className="text-sm text-red-700">{shareError}</p>}
      {/* Top Action Buttons (ดูรูปทั้งหมด, แชร์, บันทึก) */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-semibold text-gray-500">
          ภาพถ่ายสถานที่จริง ({photoList.length} รูป)
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleShare}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-surface-border text-navy-900 text-xs font-semibold rounded-lg shadow-sm transition-all"
            title="คัดลอกลิงก์เพื่อแชร์"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'คัดลอกลิงก์แล้ว' : 'แชร์'}</span>
          </button>

          <button
            onClick={handleToggleFav}
            className={`flex items-center space-x-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg shadow-sm transition-all ${
              isFavorite
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-white hover:bg-gray-50 text-navy-900 border-surface-border'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            <span>{isFavorite ? 'บันทึกแล้ว' : 'บันทึก'}</span>
          </button>

          <button
            onClick={() => setLightboxOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <Images className="w-3.5 h-3.5" />
            <span>ดูรูปทั้งหมด ({photoList.length})</span>
          </button>
        </div>
      </div>

      {/* Main Large Image */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] w-full rounded-2xl overflow-hidden bg-gray-900 shadow-card group cursor-pointer"
        onClick={() => setLightboxOpen(true)}
      >
        <Image
          src={photoList[selectedIndex]}
          alt={`${title} - รูปที่ ${selectedIndex + 1}`}
          fill
          priority
          className="object-cover transition-transform duration-500 group-hover:scale-102"
        />

        {/* Carousel Arrow Controls */}
        {photoList.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all opacity-80 hover:opacity-100"
              aria-label="Previous Image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all opacity-80 hover:opacity-100"
              aria-label="Next Image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Floating index badge */}
        <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-navy-950/80 backdrop-blur-md rounded-lg text-xs font-bold text-white border border-white/10">
          {selectedIndex + 1} / {photoList.length}
        </div>
      </div>

      {/* Thumbnail Strip */}
      {photoList.length > 1 && (
        <div className="flex space-x-2.5 overflow-x-auto pb-2 scrollbar-thin">
          {photoList.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative w-24 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 transition-all ${
                selectedIndex === idx
                  ? 'ring-2 ring-gold-500 scale-95 opacity-100'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Image
                src={img}
                alt={`Thumbnail ${idx + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8 animate-fadeIn">
          {/* Modal Header */}
          <div className="flex items-center justify-between text-white pb-4 border-b border-white/10">
            <div>
              <h4 className="font-semibold text-sm sm:text-base text-gray-200">{title}</h4>
              <p className="text-xs text-gold-400">ภาพที่ {selectedIndex + 1} จาก {photoList.length}</p>
            </div>
            <button
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Modal Image & Controls */}
          <div className="relative flex-grow flex items-center justify-center my-4">
            <div className="relative w-full h-[70vh] max-w-5xl">
              <Image
                src={photoList[selectedIndex]}
                alt={`Full preview ${selectedIndex + 1}`}
                fill
                className="object-contain"
              />
            </div>

            <button
              onClick={prevImage}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </div>

          {/* Bottom Thumbnails in Modal */}
          <div className="flex justify-center space-x-2 overflow-x-auto py-2">
            {photoList.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden flex-shrink-0 ${
                  selectedIndex === idx ? 'ring-2 ring-gold-400' : 'opacity-50 hover:opacity-80'
                }`}
              >
                <Image src={img} alt={`Thumb ${idx}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
