import React from 'react';
import PropertyDetail from '@/components/properties/PropertyDetail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug || '';
  let decodedSlug = rawSlug;
  try {
    decodedSlug = decodeURIComponent(rawSlug);
  } catch {
    decodedSlug = rawSlug;
  }

  return <PropertyDetail key={decodedSlug} slug={decodedSlug} />;
}
