import type { Metadata } from 'next';
import { propertyShareMetadata } from '@/lib/property-share-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true') return {};
  return propertyShareMetadata((await params).slug);
}

export default function PropertyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
