import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import PropertyDetailPageClient from './property-detail-page-client';

export const dynamicParams = false;

export function generateStaticParams() {
  return SAMPLE_PROPERTIES
    .filter(property => property.slug)
    .map(property => ({ slug: property.slug }));
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PropertyDetailPageClient slug={slug} />;
}
