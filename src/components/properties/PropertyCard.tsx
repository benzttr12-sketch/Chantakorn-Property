'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { propertyHref } from '@/components/properties/property-link';
import { Heart, MapPin, Bed, Bath, Maximize, Images, ImageOff, ArrowRight, Video, Scale } from 'lucide-react';
import { PropertyCardProps } from '@/lib/types';
import { formatPrice, getPropertyStatusBadge, formatThaiNumber, formatPropertyCode } from '@/lib/utils';
import { getFavoriteIds, toggleFavoriteId } from '@/lib/store/properties-store';
import { getCompareIds, toggleCompareId } from '@/lib/store/compare-store';
import SendToLineButton from '@/components/properties/SendToLineButton';

export default function PropertyCard({
  id,
  title,
  type,
  status,
  price,
  location,
  district,
  province,
  coverImage,
  images = [],
  bedrooms,
  bathrooms,
  landSize,
  usableArea,
  featured = false,
  video_url,
  slug,
  facingDirection,
}: PropertyCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [favoriteFeedback, setFavoriteFeedback] = useState(false);

  useEffect(() => {
    const favs = getFavoriteIds();
    setIsFavorite(favs.includes(id));
    setIsComparing(getCompareIds().includes(id));
    setFavoriteFeedback(false);
    setFailedImages([]);

    const handleFavUpdate = () => {
      setIsFavorite(getFavoriteIds().includes(id));
    };
    const handleCompareUpdate = () => {
      setIsComparing(getCompareIds().includes(id));
    };

    window.addEventListener('favorites-updated', handleFavUpdate);
    window.addEventListener('compare-updated', handleCompareUpdate);
    return () => {
      window.removeEventListener('favorites-updated', handleFavUpdate);
      window.removeEventListener('compare-updated', handleCompareUpdate);
    };
  }, [id]);

  const handleToggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = toggleFavoriteId(id);
    setIsFavorite(newState);
    setFavoriteFeedback(newState);
  };

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompareId(id);
    setIsComparing(result.added);
    if (result.message) {
      alert(result.message);
    }
  };

  const statusBadge = getPropertyStatusBadge(status);
  const imageCount = images.length > 0 ? images.length : coverImage ? 1 : 0;
  const displayLocation = location || `${district}, ${province}`;

  const displayImage = [coverImage, ...images].find(image => image && !failedImages.includes(image));

  return (
    <div className="property-card group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8e3da] bg-white shadow-[0_4px_24px_-14px_rgba(11,31,58,0.2)]">
      {/* 4:3 Image Container with Overlays */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 image-loading-shimmer">
        <Link href={propertyHref({ id, slug })} className="property-card-image-link relative block w-full h-full">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={title}
              fill
              unoptimized={displayImage.startsWith('data:')}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="property-card-image object-cover"
              onError={() => setFailedImages(previous => previous.includes(displayImage) ? previous : [...previous, displayImage])}
              priority={featured}
            />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-sm text-slate-500">
              <ImageOff className="h-9 w-9" aria-hidden="true" />
              <span>{imageCount ? 'ยังแสดงรูปทรัพย์ไม่ได้' : 'ยังไม่มีรูปทรัพย์'}</span>
            </span>
          )}
        </Link>

        {/* Top-Left: Status Badge */}
        <div className="absolute left-3 top-3 z-10 inline-flex min-h-8 items-center gap-2 rounded-lg border border-white/70 bg-[#fffdf8]/95 px-3 py-1.5 text-xs font-semibold text-navy-950 shadow-sm backdrop-blur-sm">
          <span>{statusBadge.text}</span>
          {featured && <span className="border-l border-[#d6b77b]/60 pl-2 text-[#755929]">ทรัพย์เด่น</span>}
        </div>

        {/* Top-Right: Compare & Favorite Buttons */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleCompare}
            aria-label={isComparing ? 'ยกเลิกการเปรียบเทียบ' : 'เลือกเปรียบเทียบ'}
            aria-pressed={isComparing}
            title={isComparing ? 'คลิกเพื่อนำออกจากการเปรียบเทียบ' : 'คลิกเพื่อเลือกเปรียบเทียบ (สูงสุด 4 หลัง)'}
            className={`property-card-control flex size-11 cursor-pointer items-center justify-center rounded-full shadow-sm backdrop-blur-sm ${
              isComparing
                ? 'bg-navy-950 text-[#efe3cb] ring-2 ring-[#d6b77b] font-bold'
                : 'bg-white/95 text-navy-800 hover:bg-[#f5eedf] hover:text-navy-950'
            }`}
          >
            <Scale className={`w-4 h-4 ${isComparing ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
          </button>

          <button
            type="button"
            onClick={handleToggleFav}
            aria-label={isFavorite ? 'ลบออกจากรายการโปรด' : 'บันทึกในรายการโปรด'}
            aria-pressed={isFavorite}
            className="property-card-control flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white hover:text-red-500"
          >
            <span className={`inline-flex ${favoriteFeedback ? 'favorite-pop' : ''}`} onAnimationEnd={() => setFavoriteFeedback(false)}>
              <Heart
                aria-hidden="true"
                className={`w-5 h-5 transition-colors ${
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-600 stroke-[2]'
                }`}
              />
            </span>
          </button>
        </div>

        {/* Bottom Image Overlay: Image Count, Video Badge & Property Code */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-2 text-xs text-white">
          <div className="flex items-center space-x-1.5">
            <span className="flex items-center gap-1.5 rounded-md bg-navy-950/60 px-2 py-1 font-medium backdrop-blur-sm">
              <Images className="h-3.5 w-3.5 text-[#efe3cb]" aria-hidden="true" />
              <span>{imageCount} รูป</span>
            </span>
            {video_url && (
              <span className="flex items-center gap-1 rounded-md bg-navy-950/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                <Video className="w-3 h-3 text-white" />
                <span>วิดีโอ</span>
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-md bg-navy-950/60 px-2 py-1 font-mono text-[10px] tracking-wide text-white/90 backdrop-blur-sm">
            {formatPropertyCode(id)}
          </span>
        </div>

        {/* Subtle Scrim */}
        <div className="absolute inset-0 bg-linear-to-t/srgb from-black/40 via-transparent to-black/10 pointer-events-none" />
      </div>

      {/* Card Content */}
      <div className="flex grow flex-col justify-between bg-white p-5">
        <div>
          {/* Location & Facing Direction */}
          <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center truncate mr-2">
              <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0 text-[#93713b]" aria-hidden="true" />
              <span className="truncate font-medium">{displayLocation}</span>
            </div>
            {facingDirection && (
              <span className="flex shrink-0 items-center gap-1 rounded-md border border-[#e8dfcf] bg-[#faf7f0] px-2 py-0.5 text-[10px] font-medium text-[#755929]">
                <span>☯</span>
                <span>{facingDirection}</span>
              </span>
            )}
          </div>

          {/* Title */}
          <Link href={propertyHref({ id, slug })} className="block group/link">
            <h3 className="min-h-[50px] text-base font-semibold leading-relaxed text-navy-950 transition-colors line-clamp-2 group-hover/link:text-[#755929]">
              {title}
            </h3>
          </Link>

          {/* Price */}
          <div className="mb-4 mt-3">
            <span className="text-xl font-semibold tracking-tight text-navy-950 tabular-nums sm:text-2xl">
              {formatPrice(price, status)}
            </span>
          </div>
        </div>

        {/* Specs Bar */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#eee9e0] pt-3 text-xs font-medium text-slate-600">
            {bedrooms > 0 ? (
              <div className="flex items-center space-x-1" title={`${bedrooms} ห้องนอน`}>
                <Bed className="w-4 h-4 text-slate-800" />
                <span>{bedrooms} นอน</span>
              </div>
            ) : (
              landSize > 0 && (
                <div className="flex items-center space-x-1" title="ขนาดที่ดิน">
                  <Maximize className="w-4 h-4 text-slate-800" />
                  <span>{formatThaiNumber(landSize)} ตร.ว.</span>
                </div>
              )
            )}

            {bathrooms > 0 && (
              <div className="flex items-center space-x-1" title={`${bathrooms} ห้องน้ำ`}>
                <Bath className="w-4 h-4 text-slate-800" />
                <span>{bathrooms} น้ำ</span>
              </div>
            )}

            {usableArea > 0 ? (
              <div className="flex items-center space-x-1" title="พื้นที่ใช้สอย">
                <Maximize className="w-4 h-4 text-slate-800" />
                <span>{formatThaiNumber(usableArea)} ตร.ม.</span>
              </div>
            ) : landSize > 0 && bedrooms > 0 ? (
              <div className="flex items-center space-x-1" title="ขนาดที่ดิน">
                <Maximize className="w-4 h-4 text-slate-800" />
                <span>{formatThaiNumber(landSize)} ตร.ว.</span>
              </div>
            ) : null}
          </div>

          {/* Action CTA */}
          <div className="mt-4 pt-1 grid grid-cols-2 gap-2">
            <Link
              href={propertyHref({ id, slug })}
              className="property-card-cta group/btn flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-navy-950 bg-navy-950 px-3 py-2.5 text-xs font-semibold text-[#efe3cb] transition-colors duration-200 hover:border-navy-800 hover:bg-navy-800"
            >
              <span>ดูรายละเอียด</span>
              <ArrowRight className="property-card-arrow h-3.5 w-3.5 text-[#d6b77b]" aria-hidden="true" />
            </Link>

            <SendToLineButton
              property={{
                id,
                title,
                price,
                status,
                district,
                province,
                slug
              }}
              variant="card"
              className="min-h-11"
              label="ส่งทาง LINE"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
