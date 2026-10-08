import { createHash } from 'node:crypto';
import { formatPropertyCode } from '@/lib/format-code';
import { getLinePropertyImageUrl } from '@/lib/line-property-image';

type FirestoreField = { stringValue?: unknown; integerValue?: unknown; doubleValue?: unknown; arrayValue?: { values?: FirestoreField[] } };
type PropertyFields = Record<string, FirestoreField | undefined>;

export type BroadcastProperty = {
  id: string;
  title: string;
  price: number;
  type: string;
  status: string;
  location: string;
  detailUrl: string;
  imageUrl?: string;
};

function text(value: unknown, fallback: string, limit: number): string {
  const clean = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  // Count UTF-16 units without cutting a surrogate pair in Thai/Unicode titles.
  let bounded = '';
  for (const character of clean) {
    if (bounded.length + character.length > limit) break;
    bounded += character;
  }
  return bounded || fallback;
}

/** A public preview and one fixed Flex message, built only from the stored listing. */
export function buildPropertyBroadcast(id: string, fields: PropertyFields, siteBase: string, imageOrigin: string) {
  const title = text(fields.title?.stringValue, 'อสังหาริมทรัพย์ Chantakorn Property', 180);
  const numericPrice = Number(fields.price?.integerValue ?? fields.price?.doubleValue ?? 0);
  const price = Number.isFinite(numericPrice) && numericPrice >= 0 && numericPrice <= Number.MAX_SAFE_INTEGER ? numericPrice : 0;
  const type = text(fields.property_type?.stringValue, 'house', 40);
  const status = fields.status?.stringValue === 'rent' ? 'rent' : 'sale';
  const location = [
    text(fields.subdistrict?.stringValue, '', 80),
    text(fields.district?.stringValue, '', 80),
    text(fields.province?.stringValue, '', 80),
  ].filter(Boolean).join(' · ') || 'หาดใหญ่-สงขลา';
  const detailUrl = `${siteBase}/properties/${encodeURIComponent(formatPropertyCode(id))}`;
  const images = Array.isArray(fields.images?.arrayValue?.values)
    ? fields.images.arrayValue.values.flatMap((value) => typeof value.stringValue === 'string' ? [value.stringValue] : []) : [];
  const imageUrl = getLinePropertyImageUrl({
    id,
    cover_image: typeof fields.cover_image?.stringValue === 'string' ? fields.cover_image.stringValue : undefined,
    images,
  }, imageOrigin) || undefined;
  const property: BroadcastProperty = { id, title, price, type, status, location, detailUrl, ...(imageUrl ? { imageUrl } : {}) };
  const typeNames: Record<string, string> = { house: 'บ้าน', land: 'ที่ดิน', condo: 'คอนโด', commercial: 'อาคารพาณิชย์', investment: 'ทรัพย์ลงทุน', consignment: 'ทรัพย์ฝากขาย' };
  const priceText = price > 0 ? `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(price)} บาท${status === 'rent' ? '/เดือน' : ''}` : 'สอบถามราคา';
  const message = {
    type: 'flex',
    altText: `🏡 ${title}`,
    contents: {
      type: 'bubble',
      ...(imageUrl ? { hero: {
        type: 'image', url: imageUrl, size: 'full', aspectRatio: '20:13', aspectMode: 'cover',
        action: { type: 'uri', uri: detailUrl },
      } } : {}),
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: `${status === 'rent' ? 'ให้เช่า' : 'ขาย'}${typeNames[type] || 'อสังหาริมทรัพย์'}`, size: 'sm', weight: 'bold', color: '#B45309' },
          { type: 'text', text: title, size: 'lg', weight: 'bold', wrap: true, maxLines: 3, color: '#0F172A' },
          { type: 'text', text: `📍 ${location}`, size: 'sm', wrap: true, color: '#64748B' },
          { type: 'text', text: priceText, size: 'lg', weight: 'bold', wrap: true, color: '#059669' },
        ],
      },
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'button', style: 'primary', color: '#0F172A', action: { type: 'uri', label: 'ดูรายละเอียดทรัพย์', uri: detailUrl } },
      ] },
    },
  };
  const payload = { messages: [message] };
  const previewRevision = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return { property, payload, previewRevision };
}
