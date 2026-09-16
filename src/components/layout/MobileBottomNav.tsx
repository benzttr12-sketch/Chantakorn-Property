'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Heart, PhoneCall } from 'lucide-react';
import { getFavoriteIds } from '@/lib/store/properties-store';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [favCount, setFavCount] = useState(0);

  useEffect(() => {
    const updateFavs = () => {
      setFavCount(getFavoriteIds().length);
    };
    updateFavs();
    window.addEventListener('favorites-updated', updateFavs);
    window.addEventListener('storage', updateFavs);
    return () => { window.removeEventListener('favorites-updated', updateFavs); window.removeEventListener('storage', updateFavs); };
  }, []);

  const items = [
    { label: 'หน้าแรก', href: '/', icon: Home },
    { label: 'ค้นหา', href: '/properties', icon: Search },
    { label: 'บันทึก', href: '/favorites', icon: Heart, count: favCount },
    { label: 'ติดต่อ', href: '/contact', icon: PhoneCall },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-navy-950/95 backdrop-blur-md border-t border-navy-800 py-2 px-6 safe-area-pb">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center relative py-1 px-3 rounded-lg transition-all ${
                isActive ? 'text-gold-400' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.count}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 font-medium ${isActive ? 'text-gold-400 font-semibold' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
