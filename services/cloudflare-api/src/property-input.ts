/**
 * Whitelist the existing Chantakorn Property form fields.
 * IDs, codes, creation timestamps, roles, media links and audit events
 * are ALWAYS generated/controlled by the trusted Worker.
 */
export const allowedEditorFields = [
  'title', 'slug', 'description', 'property_type', 'status', 'price',
  'province', 'district', 'subdistrict', 'address', 'latitude', 'longitude',
  'bedrooms', 'bathrooms', 'parking', 'land_size', 'usable_area',
  'year_built', 'furniture', 'features', 'featured', 'published',
  'facing_direction', 'feng_shui', 'video_url', 'videos', 'internal_notes', 'agent_id',
] as const;
export const inputFields = new Set<string>(allowedEditorFields);
const types = ['house', 'land', 'condo', 'commercial', 'investment', 'consignment'] as const;
const states = ['sale', 'rent'] as const;
type Kind = typeof types[number];
type Status = typeof states[number];

export type NormalizedProperty = {
  title: string; slug: string; description: string;
  propertyType: Kind; status: Status; price: number;
  province: string; district: string; subdistrict: string | null; address: string | null;
  latitude: number | null; longitude: number | null;
  bedrooms: number; bathrooms: number; parking: number;
  landSize: number; usableArea: number; yearBuilt: number | null;
  furniture: string; featuresJson: string; featured: boolean; published: boolean;
  facingDirection: string | null; fengShuiJson: string | null;
  videoUrl: string | null; videosJson: string; internalNotes: string | null;
  agentId: string | null;
};
export type ParsedProperty =
  | { ok: true; fields: Partial<NormalizedProperty> }
  | { ok: false; error: string };

const required = ['title', 'slug', 'property_type', 'status', 'price', 'province', 'district'] as const;
const jsonObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
function text(v: unknown, max: number, optional = false): string | null {
  if (v === null && optional) return null;
  if (typeof v !== 'string') return null;
  if (v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) return null;
  return v.trim();
}
function boundedNumber(v: unknown, max: number, whole = false): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max || (whole && !Number.isInteger(v))) return null;
  return v;
}
function coordinate(v: unknown, max: number): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > max) return undefined;
  return v;
}
function listStrings(v: unknown, max: number, perEntry: number): string[] | null {
  if (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== 'string' || x.length > perEntry)) return null;
  return v.map(x => x.trim()).filter(Boolean);
}

export function parseEditorInput(input: unknown, partial = false): ParsedProperty {
  if (!jsonObject(input)) return { ok: false, error: 'Expected a JSON object' };
  if (Object.keys(input).length === 0) return { ok: false, error: 'Empty property payload' };
  for (const key of Object.keys(input)) {
    if (!inputFields.has(key)) return { ok: false, error: `Unsupported property field: ${key}` };
  }
  if (!partial && required.some(key => !(key in input))) {
    return { ok: false, error: 'Missing required property fields' };
  }
  const fields: Partial<NormalizedProperty> = {};
  for (const [key, value] of Object.entries(input)) {
    switch (key) {
      case 'title': {
        const v = text(value, 180);
        if (!v || v.length < 5) return { ok: false, error: 'Title must be between 5 and 180 characters' };
        fields.title = v;
        break;
      }
      case 'slug': {
        const v = text(value, 120);
        if (!v || !/^[\p{L}\p{N}_-]{1,120}$/u.test(v)) return { ok: false, error: 'Invalid property slug' };
        fields.slug = v;
        break;
      }
      case 'description': {
        const v = text(value, 20_000);
        if (v === null) return { ok: false, error: 'Invalid description' };
        fields.description = v;
        break;
      }
      case 'property_type':
        if (!types.includes(value as Kind)) return { ok: false, error: 'Invalid property type' };
        fields.propertyType = value as Kind;
        break;
      case 'status':
        if (!states.includes(value as Status)) return { ok: false, error: 'Invalid property status' };
        fields.status = value as Status;
        break;
      case 'price': {
        const v = boundedNumber(value, 10 ** 13);
        if (v === null) return { ok: false, error: 'Invalid property price' };
        fields.price = v;
        break;
      }
      case 'province':
      case 'district': {
        const v = text(value, 100);
        if (!v) return { ok: false, error: 'Province and district are required' };
        fields[key] = v;
        break;
      }
      case 'subdistrict':
      case 'address': {
        const v = text(value, key === 'address' ? 600 : 100, true);
        if (value !== null && v === null) return { ok: false, error: `Invalid ${key}` };
        fields[key] = v;
        break;
      }
      case 'latitude':
      case 'longitude': {
        const v = coordinate(value, key === 'latitude' ? 90 : 180);
        if (v === undefined) return { ok: false, error: `Invalid ${key}` };
        fields[key] = v;
        break;
      }
      case 'bedrooms':
      case 'bathrooms':
      case 'parking': {
        const v = boundedNumber(value, 500, true);
        if (v === null) return { ok: false, error: `Invalid ${key}` };
        fields[key] = v;
        break;
      }
      case 'land_size':
      case 'usable_area': {
        const v = boundedNumber(value, 10 ** 9);
        if (v === null) return { ok: false, error: `Invalid ${key}` };
        fields[key === 'land_size' ? 'landSize' : 'usableArea'] = v;
        break;
      }
      case 'year_built': {
        if (value === null) { fields.yearBuilt = null; break; }
        const v = boundedNumber(value, 2100, true);
        if (v === null || v < 1800) return { ok: false, error: 'Invalid year built' };
        fields.yearBuilt = v;
        break;
      }
      case 'furniture': {
        const v = text(value, 120);
        if (v === null) return { ok: false, error: 'Invalid furniture' };
        fields.furniture = v;
        break;
      }
      case 'features': {
        const v = listStrings(value, 50, 100);
        if (!v) return { ok: false, error: 'Invalid property features' };
        fields.featuresJson = JSON.stringify(v);
        break;
      }
      case 'featured':
      case 'published':
        if (typeof value !== 'boolean') return { ok: false, error: `Invalid ${key}` };
        fields[key] = value;
        break;
      case 'facing_direction': {
        const v = text(value, 100, true);
        if (value !== null && v === null) return { ok: false, error: 'Invalid facing direction' };
        fields.facingDirection = v;
        break;
      }
      case 'feng_shui': {
        if (value === null) { fields.fengShuiJson = null; break; }
        if (!jsonObject(value)) return { ok: false, error: 'Invalid feng shui object' };
        const json = JSON.stringify(value);
        if (json.length > 15_000) return { ok: false, error: 'Feng shui data exceeds limit' };
        fields.fengShuiJson = json;
        break;
      }
      case 'video_url': {
        const v = text(value, 2048, true);
        if (value !== null && v === null) return { ok: false, error: 'Invalid video URL' };
        if (v && !/^https:\/\//.test(v)) return { ok: false, error: 'Video URL must use HTTPS' };
        fields.videoUrl = v;
        break;
      }
      case 'videos': {
        const v = listStrings(value, 10, 2048);
        if (!v || v.some(x => !/^https:\/\//.test(x))) return { ok: false, error: 'Invalid video links' };
        fields.videosJson = JSON.stringify(v);
        break;
      }
      case 'internal_notes': {
        const v = text(value, 12_000, true);
        if (value !== null && v === null) return { ok: false, error: 'Invalid internal notes' };
        fields.internalNotes = v;
        break;
      }
      case 'agent_id': {
        const v = text(value, 96, true);
        if (v && !/^[A-Za-z0-9_-]+$/.test(v)) return { ok: false, error: 'Invalid agent ID' };
        fields.agentId = v;
        break;
      }
      default: return { ok: false, error: 'Unsupported property field' };
    }
  }
  if (!partial) {
    const defaults: Partial<NormalizedProperty> = {
      description: '', subdistrict: null, address: null, latitude: null, longitude: null,
      bedrooms: 0, bathrooms: 0, parking: 0, landSize: 0, usableArea: 0,
      yearBuilt: null, furniture: '', featuresJson: '[]', featured: false,
      published: false, facingDirection: null, fengShuiJson: null, videoUrl: null,
      videosJson: '[]', internalNotes: null, agentId: null,
    };
    return { ok: true, fields: { ...defaults, ...fields } };
  }
  return { ok: true, fields };
}

export function newPropertyIdentity(id: string): { id: string; code: string } {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid generated UUID');
  return { id, code: `CK-${id.replaceAll('-', '').slice(0, 6).toUpperCase()}` };
}

export async function readBoundedJson(req: Request, maxSize = 32 * 1024): Promise<unknown> {
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers.get('Content-Type') ?? ''))
    throw new Error('Expected application/json');
  const declared = req.headers.get('Content-Length');
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxSize)
    throw new Error('JSON request too large');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Missing request body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSize) { await reader.cancel(); throw new Error('JSON request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
