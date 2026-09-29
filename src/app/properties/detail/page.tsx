'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const PropertyDetail = dynamic(() => import('@/components/properties/PropertyDetail'), {
  ssr: false,
  loading: () => <div className="p-16 text-center text-sm font-bold text-navy-950">กำลังโหลดรายละเอียดทรัพย์...</div>,
});

function PropertyDetailContent() {
  const params = useSearchParams();
  return <PropertyDetail key={params.get('slug') || ''} slug={params.get('slug') || ''} />;
}

export default function PropertyDetailPage() {
  return <Suspense fallback={<div className="p-16 text-center">กำลังโหลดรายละเอียดทรัพย์...</div>}><PropertyDetailContent /></Suspense>;
}
