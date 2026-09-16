'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { propertyHref } from '@/components/properties/property-link';
import { Heart, MapPin, Bed, Bath, Maximize, Images, ArrowRight } from 'lucide-react';
import { PropertyCardProps } from '@/lib/types';
import { formatPrice, getPropertyStatusBadge, formatThaiNumber } from '@/lib/utils';
import { getFavoriteIds, toggleFavoriteId } from '@/lib/store/properties-store';

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
  slug,
}: PropertyCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const favs = getFavoriteIds();
    setIsFavorite(favs.includes(id));

    const handleUpdate = () => {
      setIsFavorite(getFavoriteIds().includes(id));
    };
    window.addEventListener('favorites-updated', handleUpdate);
    return () => window.removeEventListener('favorites-updated', handleUpdate);
  }, [id]);

  const handleToggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = toggleFavoriteId(id);
    setIsFavorite(newState);
  };

  const statusBadge = getPropertyStatusBadge(status);
  const imageCount = images.length > 0 ? images.length : 1;
  const displayLocation = location || `${district}, ${province}`;

  // Fallback image in case of broken link
  const displayImage = imageError
    ? 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80'
    : coverImage || images[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-surface-border shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1">
      {/* 4:3 Image Container with Overlays */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <Link href={propertyHref(slug)} className="block w-full h-full">
          <Image
            src={displayImage}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={() => setImageError(true)}
            priority={featured}
          />
        </Link>

        {/* Top-Left: Status Badge */}
        <div className="absolute top-3.5 left-3.5 flex items-center space-x-1.5 z-10">
          <span className={`px-3 py-1 rounded-full text-xs tracking-wide shadow-md ${statusBadge.bgClass} ${statusBadge.textClass}`}>
            {statusBadge.text}
          </span>
          {featured && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-navy-900/90 text-gold-400 border border-gold-400/40 shadow-md">
              ทรัพย์เด่น
            </span>
          )}
        </div>

        {/* Top-Right: Favorite Button */}
        <button
          onClick={handleToggleFav}
          aria-label={isFavorite ? 'ลบออกจากรายการโปรด' : 'บันทึกในรายการโปรด'}
          className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-gray-700 hover:text-red-500 shadow-md hover:scale-110 active:scale-95 transition-all"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600 stroke-[2]'
            }`}
          />
        </button>

        {/* Bottom Image Overlay: Image Count & Type */}
        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs text-white z-10 pointer-events-none">
          <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-md flex items-center space-x-1">
            <Images className="w-3.5 h-3.5 text-gold-400" />
            <span>{imageCount} รูป</span>
          </span>
        </div>

        {/* Gradient shadow for contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
      </div>

      {/* Card Content Below Image */}
      <div className="p-5 flex flex-col flex-grow justify-between">
        <div>
          {/* Location Line */}
          <div className="flex items-center text-brand-muted text-xs mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-gold-600 mr-1 flex-shrink-0" />
            <span className="truncate">{displayLocation}</span>
          </div>

          {/* Property Title */}
          <Link href={propertyHref(slug)} className="block group-hover:text-navy-700 transition-colors">
            <h3 className="font-semibold text-brand-text text-base leading-snug line-clamp-2 min-h-[44px] hover:underline">
              {title}
            </h3>
          </Link>

          {/* Price */}
          <div className="mt-3 mb-4">
            <span className="text-xl font-bold text-navy-800 tracking-tight">
              {formatPrice(price, status)}
            </span>
          </div>
        </div>

        {/* Property Stats Bar */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-brand-muted text-xs">
          {bedrooms > 0 ? (
            <div className="flex items-center space-x-1" title={`${bedrooms} ห้องนอน`}>
              <Bed className="w-3.5 h-3.5 text-navy-800" />
              <span>{bedrooms} นอน</span>
            </div>
          ) : (
            landSize > 0 && (
              <div className="flex items-center space-x-1" title="ขนาดที่ดิน">
                <Maximize className="w-3.5 h-3.5 text-navy-800" />
                <span>{formatThaiNumber(landSize)} ตร.ว.</span>
              </div>
            )
          )}

          {bathrooms > 0 && (
            <div className="flex items-center space-x-1" title={`${bathrooms} ห้องน้ำ`}>
              <Bath className="w-3.5 h-3.5 text-navy-800" />
              <span>{bathrooms} น้ำ</span>
            </div>
          )}

          {usableArea > 0 ? (
            <div className="flex items-center space-x-1" title="พื้นที่ใช้สอย">
              <Maximize className="w-3.5 h-3.5 text-navy-800" />
              <span>{formatThaiNumber(usableArea)} ตร.ม.</span>
            </div>
          ) : landSize > 0 && bedrooms > 0 ? (
            <div className="flex items-center space-x-1" title="ขนาดที่ดิน">
              <Maximize className="w-3.5 h-3.5 text-navy-800" />
              <span>{formatThaiNumber(landSize)} ตร.ว.</span>
            </div>
          ) : null}
        </div>

        {/* View Details CTA Button */}
        <div className="mt-4 pt-2">
          <Link
            href={propertyHref(slug)}
            className="w-full py-2.5 px-4 bg-navy-50 hover:bg-navy-800 text-navy-900 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all duration-200 group/btn"
          >
            <span>ดูรายละเอียด</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover/btn:translate-x-1 transition-transform text-gold-500" />
          </Link>
        </div>
      </div>
    </div>
  );
}
