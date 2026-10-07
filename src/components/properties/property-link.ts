import { Property } from '@/lib/types';
import { formatPropertyCode } from '@/lib/format-code';

/**
 * ลิงก์หน้ารายละเอียดทรัพย์แบบสั้น: ใช้รหัสทรัพย์ (เช่น CK-813F2B) แทน slug ภาษาไทยยาว
 * ลิงก์เก่าแบบ slug เดิมยังใช้ได้ เพราะหน้า detail ค้นหาจากทั้ง slug, id และรหัสทรัพย์
 */
export function propertyHref(propOrSlug: string | Property | { slug?: string; id?: string }): string {
  if (!propOrSlug) return '/properties';
  if (typeof propOrSlug === 'string') {
    return '/properties/' + encodeURIComponent(propOrSlug);
  }
  const code = propOrSlug.id ? formatPropertyCode(propOrSlug.id) : '';
  const key = code || propOrSlug.slug || '';
  return '/properties/' + encodeURIComponent(key);
}
