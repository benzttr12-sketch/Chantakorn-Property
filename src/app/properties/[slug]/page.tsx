import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';
import PropertyDetail from '@/components/properties/PropertyDetail';
import { formatPrice } from '@/lib/utils';

interface PageProps { params: Promise<{ slug: string }> }
export const dynamicParams = true;
export function generateStaticParams() {
  return SAMPLE_PROPERTIES.map(property => ({ slug: property.slug }));
}

// Dynamic SEO metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = SAMPLE_PROPERTIES.find(property => property.slug === slug);
  if (!property) {
    return {
      title: 'รายละเอียดอสังหาริมทรัพย์ | CHANTAKORN PROPERTY',
      description: 'ดูข้อมูลอสังหาริมทรัพย์และติดต่อ Chantakorn Property หาดใหญ่–สงขลา',
    };
  }

  const priceText = formatPrice(property.price, property.status);
  const title = `${property.title} | Chantakorn Property หาดใหญ่ สงขลา`;
  const description = `${property.title} ทำเลดีใน ${property.district} จ.สงขลา ${priceText} รายละเอียด ราคา รูปภาพ และข้อมูลติดต่อ Chantakorn Property`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: property.cover_image,
          width: 1200,
          height: 630,
          alt: property.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [property.cover_image],
    },
  };
}


export default async function PropertyDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const property = SAMPLE_PROPERTIES.find(item => item.slug === slug);
  return <PropertyDetail slug={slug} initialProperty={property || null} />;
}
