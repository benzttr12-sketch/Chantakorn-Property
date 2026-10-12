const publicFields = [
  'id', 'title', 'slug', 'description', 'property_type', 'status', 'price', 'province', 'district',
  'subdistrict', 'address', 'latitude', 'longitude', 'coordinates_available', 'facing_direction',
  'bedrooms', 'bathrooms', 'parking', 'land_size', 'usable_area', 'year_built', 'furniture',
  'features', 'cover_image', 'images', 'video_url', 'videos', 'featured', 'published',
  'agent_id', 'created_at', 'updated_at',
] as const;
const agentFields = ['id', 'name', 'rank', 'title', 'phone', 'line_id', 'facebook', 'email', 'photo_url', 'bio', 'user_id'];
const fengShuiFields = ['direction', 'degrees', 'element', 'elementColor', 'score', 'grade', 'meaning', 'summary', 'highlights', 'windEnergy', 'sunEnergy', 'suitableFor', 'luckyColors', 'auspiciousDecorTips', 'auspiciousNumbers', 'qiFlow'];
function pick(source: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(fields.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
}

/** Use an allowlist: new internal fields never become public by accident. */
export function publicProperty(row: Record<string, unknown>, origin: string): Record<string, unknown> | null {
  if (row.published !== true) return null;
  const result = pick(row, publicFields);
  if (row.agent && typeof row.agent === 'object') result.agent = pick(row.agent as Record<string, unknown>, agentFields);
  if (row.feng_shui && typeof row.feng_shui === 'object') result.feng_shui = pick(row.feng_shui as Record<string, unknown>, fengShuiFields);
  const base = `${origin}/api/properties/${encodeURIComponent(String(row.id))}/image`;
  result.images = Array.isArray(row.images) ? row.images.map((photo, index) => typeof photo === 'string' && photo.startsWith('data:') ? `${base}?index=${index}` : photo) : [];
  result.cover_image = typeof row.cover_image === 'string' && row.cover_image.startsWith('data:') ? base : row.cover_image;
  return result;
}
