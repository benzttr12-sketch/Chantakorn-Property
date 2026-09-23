'use client';

import React, { use } from 'react';
import PropertyDetail from '@/components/properties/PropertyDetail';

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

export default function PropertyDetailPage({ params }: PageProps) {
  const resolvedParams = typeof (params as any)?.then === 'function' 
    ? use(params as Promise<{ slug: string }>) 
    : (params as { slug: string });

  const rawSlug = resolvedParams?.slug || '';
  let decodedSlug = rawSlug;
  try {
    decodedSlug = decodeURIComponent(rawSlug);
  } catch {
    decodedSlug = rawSlug;
  }

  return <PropertyDetail key={decodedSlug} slug={decodedSlug} />;
}
