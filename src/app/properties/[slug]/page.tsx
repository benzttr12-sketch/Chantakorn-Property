'use client';

import React, { use } from 'react';
import PropertyDetail from '@/components/properties/PropertyDetail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PropertyDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const decodedSlug = decodeURIComponent(slug);

  return <PropertyDetail key={decodedSlug} slug={decodedSlug} />;
}
