'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { propertyHref } from '@/components/properties/property-link';
import { Heart, MapPin, Bed, Bath, Maximize, Images, ArrowRight, Video, Scale } from 'lucide-react';
import { PropertyCardProps } from '@/lib/types';
import { formatPrice, getPropertyStatusBadge, formatThaiNumber, formatPropertyCode } from '@/lib/utils';
import { getFavoriteIds, toggleFavoriteId } from '@/lib/store/properties-store';
import { getCompareIds, toggleCompareId } from '@/lib/store/compare-store';
import { villaModernEstate } from '@/assets/images';
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
  const [imageError, setImageError] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState(false);

  useEffect(() => {
    const favs = getFavoriteIds();
    setIsFavorite(favs.includes(id));
    setIsComparing(getCompareIds().includes(id));
    setFavoriteFeedback(false);

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
  const imageCount = images.length > 0 ? images.length : 1;
  const displayLocation = location || `${district}, ${province}`;

  const displayImage = imageError
    ? villaModernEstate
    : coverImage || images[0] || villaModernEstate;

  return (
    <div className="property-card group bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col h-full">
      {/* 4:3 Image Container with Overlays */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <Link href={propertyHref(slug)} className="property-card-image-link relative block w-full h-full">
          <Image
            src={displayImage}
            alt={title}
            fill
            unoptimized={typeof displayImage === 'string' && displayImage.startsWith('data:')}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="property-card-image object-cover"
            onError={() => {
              if (typeof displayImage === 'string' && !displayImage.startsWith('data:')) {
                setImageError(true);
              }
            }}
            priority={featured}
          />
        </Link>

        {/* Top-Left: Status Badge */}
        <div className="absolute top-3.5 left-3.5 flex items-center space-x-1.5 z-10">
          <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-md ${statusBadge.bgClass} ${statusBadge.textClass}`}>
            {statusBadge.text}
          </span>
          {featured && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-navy-950 text-gold-400 border border-gold-400/40 shadow-md">
              ทรัพย์เด่น
            </span>
          )}
        </div>

        {/* Top-Right: Compare & Favorite Buttons */}
        <div className="absolute top-3.5 right-3.5 z-10 flex items-center space-x-1.5">
          <button
            type="button"
            onClick={handleToggleCompare}
            aria-label={isComparing ? 'ยกเลิกการเปรียบเทียบ' : 'เลือกเปรียบเทียบ'}
            aria-pressed={isComparing}
            title={isComparing ? 'คลิกเพื่อนำออกจากการเปรียบเทียบ' : 'คลิกเพื่อเลือกเปรียบเทียบ (สูงสุด 4 หลัง)'}
            className={`property-card-control w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center shadow-md cursor-pointer ${
              isComparing
                ? 'bg-navy-950 text-gold-400 ring-2 ring-gold-400 font-bold'
                : 'bg-white/90 text-slate-700 hover:text-navy-950 hover:bg-white'
            }`}
          >
            <Scale className={`w-4 h-4 ${isComparing ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
          </button>

          <button
            type="button"
            onClick={handleToggleFav}
            aria-label={isFavorite ? 'ลบออกจากรายการโปรด' : 'บันทึกในรายการโปรด'}
            aria-pressed={isFavorite}
            className="property-card-control w-9 h-9 rounded-full bg-white/90 hover:bg-white backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-red-500 shadow-md cursor-pointer"
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
        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs text-white z-10 pointer-events-none">
          <div className="flex items-center space-x-1.5">
            <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg flex items-center space-x-1 font-medium">
              <Images className="w-3.5 h-3.5 text-gold-400" />
              <span>{imageCount} รูป</span>
            </span>
            {video_url && (
              <span className="px-2 py-1 bg-red-600 text-white font-bold backdrop-blur-md rounded-lg flex items-center space-x-1 text-[11px] shadow-sm">
                <Video className="w-3 h-3 text-white" />
                <span>วิดีโอ</span>
              </span>
            )}
          </div>
          <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg font-mono text-[11px] font-bold text-gold-300 tracking-wider">
            {formatPropertyCode(id)}
          </span>
        </div>

        {/* Subtle Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />
      </div>

      {/* Card Content */}
      <div className="p-5 sm:p-6 flex flex-col flex-grow justify-between bg-white">
        <div>
          {/* Location & Facing Direction */}
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <div className="flex items-center truncate mr-2">
              <MapPin className="w-3.5 h-3.5 text-gold-600 mr-1 flex-shrink-0" />
              <span className="truncate font-medium">{displayLocation}</span>
            </div>
            {facingDirection && (
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 flex-shrink-0 flex items-center gap-1">
                <span>☯</span>
                <span>{facingDirection}</span>
              </span>
            )}
          </div>

          {/* Title */}
          <Link href={propertyHref(slug)} className="block group/link">
            <h3 className="font-bold text-navy-950 text-base leading-snug line-clamp-2 min-h-[44px] group-hover/link:text-gold-700 transition-colors">
              {title}
            </h3>
          </Link>

          {/* Price */}
          <div className="mt-3 mb-4">
            <span className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight font-mono">
              {formatPrice(price, status)}
            </span>
          </div>
        </div>

        {/* Specs Bar */}
        <div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-600 text-xs font-medium">
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
              href={propertyHref(slug)}
              className="property-card-cta py-2.5 px-3 bg-navy-950 hover:bg-navy-800 text-gold-400 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors duration-200 group/btn border border-navy-950 hover:border-navy-800"
            >
              <span>ดูรายละเอียด</span>
              <ArrowRight className="property-card-arrow w-3.5 h-3.5 text-gold-400" />
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
              label="ส่งทาง LINE"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
