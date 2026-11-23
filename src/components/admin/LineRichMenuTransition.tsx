'use client';

import { useEffect, useRef, useState } from 'react';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { fetchStaffApi } from '@/lib/staff-api';
import { TRANSITION_ENABLED } from '@/lib/line-recovery/transition-enabled';

export default function LineRichMenuTransition({ checkedDefault, onAttemptStarted, onAttemptFinished }: { checkedDefault: boolean; onAttemptStarted: () => void; onAttemptFinished: () => void }) {
  const [admin, setAdmin] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'ready' | 'sending' | 'success' | 'stopped'>('ready');
  const started = useRef(false);
  useEffect(() => {
    let active = true;
    void getCurrentUserProfile().then(profile => { if (active) setAdmin(profile?.role === 'ADMIN'); }).catch(() => { if (active) setAdmin(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (started.current || !checkedDefault || confirmation !== '@930xzcyi') return;
    started.current = true;
    onAttemptStarted();
    setStatus('sending');
    try {
      const response = await fetchStaffApi('/api/line/transition-rich-menu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: '@930xzcyi' }), cache: 'no-store' });
      const result: unknown = await response.json();
      setStatus(response.ok && !!result && typeof result === 'object' && 'success' in result && result.success === true && 'code' in result && result.code === 'TRANSITIONED' ? 'success' : 'stopped');
    } catch { setStatus('stopped'); } finally { onAttemptFinished(); }
  }
  if (!TRANSITION_ENABLED || !admin || (status === 'ready' && !checkedDefault)) return null;
  return <section aria-labelledby="transition-menu-title" className="admin-panel space-y-4 border border-amber-300 text-sm">
    <h2 id="transition-menu-title" className="font-semibold text-navy-950">เปลี่ยนปุ่มฝากขายของเมนูหลัก @930xzcyi</h2>
    <p>ระบบจะสร้างเมนูหลักใหม่โดยใช้ภาพเดิมและคงอีก 5 ปุ่มเดิม ปุ่ม “ฝากขายทรัพย์” จะส่งข้อความ “บริการฝากขาย” เพื่อแสดงการ์ดข้อมูลฝากขายและขายฝากใน LINE พร้อมปุ่มไปเว็บไซต์ แทนการเปิดเว็บไซต์ทันที</p>
    <p className="rounded-xl bg-amber-50 p-4 leading-relaxed text-amber-950">เมนูหลักจาก API มีลำดับเหนือเมนูใน OA Manager ส่วนเมนูที่ผูกกับผู้ใช้รายบุคคลยังมีลำดับสูงกว่า ระบบจะตรวจบัญชี เมนูและภาพเดิมก่อนเปลี่ยน และเก็บเมนูเดิมไว้ ผู้อื่นอาจเปลี่ยนค่าในระหว่างการตรวจสอบได้ หากขาดการเชื่อมต่อหรือเกิดข้อผิดพลาด ผลอาจไม่แน่นอน อย่าลองซ้ำ ให้ผู้ดูแลตรวจสอบสถานะก่อน</p>
    {status === 'ready' && <form onSubmit={submit} className="space-y-3"><label htmlFor="line-transition-confirmation" className="block font-medium">พิมพ์ @930xzcyi เพื่อยืนยันเปลี่ยนเมนูหลักจริง</label><input id="line-transition-confirmation" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full max-w-sm rounded-xl border border-slate-300 px-3 py-2" /><button type="submit" disabled={confirmation !== '@930xzcyi'} className="admin-primary disabled:opacity-50">ยืนยันสร้างและเปลี่ยนเมนูหลัก</button></form>}
    {status === 'sending' && <p role="status">กำลังดำเนินการ กรุณาอย่าส่งคำขอซ้ำ</p>}
    {status === 'success' && <p role="status" className="text-emerald-700">เปลี่ยนและตรวจสอบเมนูหลักผ่าน API แล้ว กรุณาตรวจการแสดงผลและการตอบกลับจริงใน LINE บนมือถือ</p>}
    {status === 'stopped' && <p role="alert" className="font-medium text-red-700">ไม่สามารถยืนยันผลได้ อาจมีการเปลี่ยนแปลงบางส่วนแล้ว อย่าลองซ้ำ ให้ผู้ดูแลตรวจสอบสถานะก่อนดำเนินการต่อ</p>}
  </section>;
}
