/**
 * จัดรูปแบบรหัสทรัพย์ (Property Code) ให้กระชับ สั้น จำง่าย และเป็นมาตรฐาน
 * เช่น:
 * - "prop-01" -> "CK-01"
 * - "prop-02" -> "CK-02"
 * - UUID "c89f3a5b-9d41-477e-8c3b-1e249f0a218d" -> "CK-C89F3A"
 * - "ck-7f4a2b" -> "CK-7F4A2B"
 */
export function formatPropertyCode(id: string | undefined | null): string {
  if (!id) return '-';
  const clean = id.trim();

  // หากขึ้นต้นด้วย CK- หรือ CKP- อยู่แล้ว ให้ใช้ตัวพิมพ์ใหญ่
  if (/^CKP?-[A-Z0-9]+$/i.test(clean)) {
    return clean.toUpperCase();
  }

  // หากเป็น prop-01, prop-02 หรือ prop-...-01 ให้แปลงเป็น CK-01, CK-02
  const propNumMatch = clean.match(/^prop-(?:.*-)?(\d+)$/i);
  if (propNumMatch) {
    return `CK-${propNumMatch[1].padStart(2, '0')}`;
  }

  // หากเป็น prop- ทั่วไป
  if (/^prop-/i.test(clean)) {
    const suffix = clean.replace(/^prop-/i, '').replace(/[^a-zA-Z0-9]/g, '');
    return `CK-${suffix.slice(-4).toUpperCase()}`;
  }

  // หากเป็น UUID ความยาวมาก ให้ตัดเหลือ 6 ตัวอักษรแรกเพื่อความกะทัดรัด
  if (clean.includes('-') && clean.length >= 20) {
    const hex = clean.replace(/-/g, '');
    return `CK-${hex.slice(0, 6).toUpperCase()}`;
  }

  // หากเป็นรหัสยาวเกิน 8 ตัวอักษร
  if (clean.length > 8) {
    return `CK-${clean.slice(0, 6).toUpperCase()}`;
  }

  // รหัสสั้นอื่นๆ
  if (!clean.toUpperCase().startsWith('CK-')) {
    return `CK-${clean.toUpperCase()}`;
  }

  return clean.toUpperCase();
}
