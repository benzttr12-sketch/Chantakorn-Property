'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const PropertyDetail = dynamic(() => import('@/components/properties/PropertyDetail'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-navy-950">กำลังโหลดข้อมูลทรัพย์...</p>
      </div>
    </div>
  ),
});

export default function PropertyDetailPage() {
  const params = useParams();
  const rawSlug = (params?.slug as string) || '';
  let decodedSlug = rawSlug;
  try {
    decodedSlug = decodeURIComponent(rawSlug);
  } catch {
    decodedSlug = rawSlug;
  }

  return <PropertyDetail key={decodedSlug} slug={decodedSlug} />;
}
