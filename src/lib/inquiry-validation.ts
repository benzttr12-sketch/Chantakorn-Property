import type { Inquiry } from './types';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateInquiry(input: unknown): Omit<Inquiry, 'created_at'> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('ข้อมูลไม่ถูกต้อง');
  const fields = input as Record<string, unknown>;
  const allowed = ['id', 'name', 'phone', 'line_id', 'message', 'inquiry_type', 'status', 'property_id', 'property_title', 'consignment_details', 'media_token'];
  if (Object.keys(fields).some(key => !allowed.includes(key))) throw new Error('ข้อมูลไม่ถูกต้อง');
  function text(source: Record<string, unknown>, key: string, max: number, required = false) {
    const value = source[key];
    if (value === undefined && !required) return '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required && !value.trim())) throw new Error('กรุณาตรวจข้อมูลในฟอร์ม');
    return value.trim();
  }
  const id = text(fields, 'id', 36, true);
  if (!UUID.test(id)) throw new Error('รหัสคำขอไม่ถูกต้อง');
  const phone = text(fields, 'phone', 30, true);
  if (!/^[+\d() -]{7,30}$/.test(phone)) throw new Error('กรุณาตรวจเบอร์โทรศัพท์');
  const inquiry_type = fields.inquiry_type;
  if (inquiry_type !== 'inquiry' && inquiry_type !== 'viewing' && inquiry_type !== 'consignment_sell') throw new Error('ประเภทคำขอไม่ถูกต้อง');
  const result: Omit<Inquiry, 'created_at'> = { id, name: text(fields, 'name', 120, true), phone, message: text(fields, 'message', 4000, true), line_id: text(fields, 'line_id', 120), inquiry_type, status: 'new' };
  const propertyId = text(fields, 'property_id', 256);
  if (propertyId) { result.property_id = propertyId; result.property_title = text(fields, 'property_title', 250); }
  if (fields.consignment_details !== undefined) {
    if (inquiry_type !== 'consignment_sell' || !fields.consignment_details || typeof fields.consignment_details !== 'object' || Array.isArray(fields.consignment_details)) throw new Error('ข้อมูลฝากขายไม่ถูกต้อง');
    const details = fields.consignment_details as Record<string, unknown>;
    const keys = ['property_type', 'province', 'district', 'subdistrict', 'expected_price', 'land_size', 'usable_area', 'photos_count', 'photos'];
    if (Object.keys(details).some(key => !keys.includes(key))) throw new Error('ข้อมูลฝากขายไม่ถูกต้อง');
    function number(key: string, required = false) {
      if (details[key] === undefined && !required) return undefined;
      const value = details[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) throw new Error('ตัวเลขในข้อมูลฝากขายไม่ถูกต้อง');
      return value;
    }
    const photos = details.photos ?? [];
    if (!Array.isArray(photos) || photos.length > 15 || photos.some(photo => typeof photo !== 'string' || !UUID.test(photo))) throw new Error('รูปที่แนบไม่ถูกต้อง');
    result.consignment_details = {
      property_type: text(details, 'property_type', 100, true), province: text(details, 'province', 100, true), district: text(details, 'district', 100, true),
      subdistrict: text(details, 'subdistrict', 100), expected_price: number('expected_price', true)!,
      ...(details.land_size !== undefined ? { land_size: number('land_size') } : {}),
      ...(details.usable_area !== undefined ? { usable_area: number('usable_area') } : {}), photos: photos as string[], photos_count: photos.length,
    };
  }
  return result;
}
