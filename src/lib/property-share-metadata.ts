import type { Metadata } from 'next';
import { getPublishedPropertyDocument } from '@/lib/server-property-catalog';
import { formatPropertyCode } from '@/lib/format-code';

type Value = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: null; arrayValue?: { values?: Value[] } };

/** Public data only: never fetch staff previews or send user credentials. */
export async function propertyShareMetadata(identifier: string): Promise<Metadata> {
  if (!/^[\p{L}\p{N}_-]{1,120}$/u.test(identifier)) return {};
  try {
    const response = await getPublishedPropertyDocument(identifier);
    if (!response.ok) return {};
    const data = await response.json() as { fields?: Record<string, Value> };
    const f = data.fields;
    if (!f || f.published?.booleanValue !== true ||
        (f.deleted_at && !('nullValue' in f.deleted_at)) || (f.deletedAt && !('nullValue' in f.deletedAt))) return {};
    const title = f.title?.stringValue?.trim().slice(0, 180);
    const id = f.id?.stringValue || identifier;
    if (!title || !/^[\p{L}\p{N}_-]{1,120}$/u.test(id)) return {};
    const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://chantakornproperty.com');
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) return {};
    const canonical = new URL(`/properties/${encodeURIComponent(formatPropertyCode(id))}`, origin.origin).href;
    const price = Number(f.price?.integerValue ?? f.price?.doubleValue);
    const location = [f.subdistrict?.stringValue, f.district?.stringValue, f.province?.stringValue].filter(Boolean).join(', ');
    const description = [location, Number.isFinite(price) && price > 0 ? `฿${new Intl.NumberFormat('th-TH').format(price)}${f.status?.stringValue === 'rent' ? ' / เดือน' : ''}` : '', f.description?.stringValue?.replace(/\s+/g, ' ').trim()].filter(Boolean).join(' · ').slice(0, 240);
    const candidates = [f.cover_image?.stringValue, ...(f.images?.arrayValue?.values || []).map(item => item.stringValue)];
    const image = candidates.find(value => {
      if (!value || value.length > 2000) return false;
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
    });
    return {
      title, description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical, siteName: 'CHANTAKORN PROPERTY', locale: 'th_TH', type: 'website', ...(image ? { images: [{ url: image, alt: title }] } : {}) },
      twitter: { card: 'summary_large_image', title, description, ...(image ? { images: [image] } : {}) },
    };
  } catch { return {}; }
}
