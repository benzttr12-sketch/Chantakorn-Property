'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PropertyDetail from '@/components/properties/PropertyDetail';

function PropertyDetailContent() {
  const params = useSearchParams();
  return <PropertyDetail key={params.get('slug') || ''} slug={params.get('slug') || ''} />;
}

export default function PropertyDetailPage() {
  return <Suspense fallback={<div className="p-16 text-center">กำลังโหลดรายละเอียดทรัพย์...</div>}><PropertyDetailContent /></Suspense>;
}
