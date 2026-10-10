import type { Inquiry, Property } from '@/lib/types';

export interface MonthlyActivity { key: string; label: string; properties: number; inquiries: number; }

export function getMonthlyActivity(properties: Pick<Property, 'created_at'>[], inquiries: Pick<Inquiry, 'created_at'>[], now = new Date()): MonthlyActivity[] {
  const monthFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' });
  const dateParts = monthFormatter.formatToParts(now);
  const currentYear = Number(dateParts.find((part) => part.type === 'year')?.value);
  const currentMonth = Number(dateParts.find((part) => part.type === 'month')?.value) - 1;
  const keyForDate = (date: Date) => {
    const parts = monthFormatter.formatToParts(date);
    return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
  };
  const rows = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(currentYear, currentMonth - 5 + index, 15));
    return { key: keyForDate(date), label: date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'short', year: '2-digit' }), properties: 0, inquiries: 0 };
  });
  const byMonth = new Map(rows.map((row) => [row.key, row]));
  const addRecords = (items: { created_at: string }[], field: 'properties' | 'inquiries') => {
    items.forEach((item) => {
      const date = new Date(item.created_at);
      if (!Number.isFinite(date.getTime()) || date > now) return;
      const row = byMonth.get(keyForDate(date));
      if (row) row[field] += 1;
    });
  };
  addRecords(properties, 'properties');
  addRecords(inquiries, 'inquiries');
  return rows;
}

export default function AdminMonthlyActivity({ properties, inquiries, loading, unavailable, now }: { properties: Property[]; inquiries: Inquiry[]; loading: boolean; unavailable: boolean; now?: Date }) {
  const rows = getMonthlyActivity(properties, inquiries, now);
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.properties, row.inquiries]));
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-navy-950">กิจกรรมย้อนหลัง 6 เดือน</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">จำนวนทรัพย์และผู้ติดต่อใหม่ ตามวันที่สร้างของรายการที่ยังอยู่ในระบบ</p></div><div className="flex items-center gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-navy-900" />ทรัพย์</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold-400" />ผู้ติดต่อ</span></div></div>
      {loading || unavailable ? <p className="py-10 text-center text-sm text-slate-400" role="status">{loading ? 'กำลังโหลดข้อมูลย้อนหลัง...' : 'ยังโหลดข้อมูลย้อนหลังไม่ได้'}</p> : <><div className="mt-6 grid grid-cols-6 gap-2 sm:gap-5" aria-hidden="true">{rows.map((row) => <div key={row.key} className="min-w-0"><div className="flex h-28 items-end justify-center gap-1.5 border-b border-slate-100 pb-1"><div className="w-3 max-w-[45%] rounded-t bg-navy-900 sm:w-5" style={{ height: `${row.properties / maximum * 90}px`, minHeight: row.properties ? 3 : 0 }} /><div className="w-3 max-w-[45%] rounded-t bg-gold-400 sm:w-5" style={{ height: `${row.inquiries / maximum * 90}px`, minHeight: row.inquiries ? 3 : 0 }} /></div><p className="mt-2 text-center text-[9px] text-slate-400 sm:text-[11px]">{row.label}</p><p className="mt-1 text-center text-[10px] font-semibold text-navy-950">{row.properties} / {row.inquiries}</p></div>)}</div><table className="sr-only"><caption>จำนวนทรัพย์ใหม่และผู้ติดต่อใหม่ แบ่งตามเดือน</caption><thead><tr><th>เดือน</th><th>ทรัพย์ใหม่</th><th>ผู้ติดต่อใหม่</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><th>{row.label}</th><td>{row.properties}</td><td>{row.inquiries}</td></tr>)}</tbody></table>{rows.every((row) => !row.properties && !row.inquiries) && <p className="mt-4 text-center text-xs text-slate-400">ยังไม่มีรายการสร้างใหม่ในช่วง 6 เดือนนี้</p>}</>}
    </section>
  );
}
