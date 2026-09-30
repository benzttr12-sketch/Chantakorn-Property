import type { Property } from '@/lib/types';

/** Do not send embedded images, private notes, or the full listing to LINE. */
export function buildLinePropertyPayload(property: Property) {
  return {
    title: property.title?.slice(0, 250),
    price: property.price,
    status: property.status,
    district: property.district?.slice(0, 100),
    subdistrict: property.subdistrict?.slice(0, 100),
    slug: property.slug?.slice(0, 300),
    cover_image: property.cover_image?.startsWith('https://') && property.cover_image.length <= 2000
      ? property.cover_image : undefined,
    agent: property.agent ? {
      name: property.agent.name?.slice(0, 100),
      phone: property.agent.phone?.slice(0, 30),
    } : undefined,
  };
}
