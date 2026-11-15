'use client';

import { useEffect, useRef, useState } from 'react';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { fetchStaffApi } from '@/lib/staff-api';

/** One-use recovery for the fixed menu. The server independently enforces every guard. */
export default function LineRichMenuRestore({ checkedEmpty, onAttemptStarted, onAttemptFinished }: { checkedEmpty: boolean; onAttemptStarted: () => void; onAttemptFinished: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'ready' | 'sending' | 'success' | 'stopped'>('ready');
  const started = useRef(false);

  useEffect(() => {
    let active = true;
    void getCurrentUserProfile().then(profile => {
      if (active) setIsAdmin(profile?.role === 'ADMIN');
    }).catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, []);

  async function restore(event: React.FormEvent) {
    event.preventDefault();
    if (started.current || !checkedEmpty || confirmation !== '@930xzcyi') return;
    started.current = true;
    onAttemptStarted();
    setStatus('sending');
    try {
      const response = await fetchStaffApi('/api/line/restore-rich-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: '@930xzcyi' }),
        cache: 'no-store',
      });
      const result: unknown = await response.json();
      if (response.ok && result && typeof result === 'object' && 'success' in result && result.success === true && 'code' in result && result.code === 'RESTORED') {
        setStatus('success');
      } else {
        setStatus('stopped');
      }
    } catch {
      // The server may have completed a write even if the response was lost.
      setStatus('stopped');
    } finally {
      onAttemptFinished();
    }
  }

  if (!isAdmin) return null;
  return (
    <section aria-labelledby="restore-menu-title" className="admin-panel space-y-4 border border-amber-300 text-sm">
      <h2 id="restore-menu-title" className="font-semibold text-navy-950">กู้คืนริชเมนูสำหรับบัญชี @930xzcyi</h2>
      <p className="leading-relaxed text-slate-700">ผู้ดูแลระบบสามารถสร้างเมนูเดิมที่กำหนดไว้พร้อมภาพเดิม และตั้งเป็นเมนูหลักผ่าน API หนึ่งครั้ง ระบบจะตรวจบัญชี สถานะเมนู และภาพอีกครั้งก่อนเปลี่ยนค่า</p>
      <p className="leading-relaxed text-slate-700">เมนูมี 6 ช่อง: ค้นหาทรัพย์, ฝากขายทรัพย์, นัดชม/สอบถาม, ประเมินราคา, บทความ/ข่าวสาร และติดต่อเรา</p>
      <div className="rounded-xl bg-amber-50 p-4 leading-relaxed text-amber-950">
        <p>เมนูหลักจาก API มีลำดับเหนือเมนูใน LINE OA Manager รวมถึงเมนูหมายเลข 20269826 ซึ่งยังไม่ได้ยืนยันสถานะ และไม่มีวันหมดอัตโนมัติ ส่วนเมนูที่ผูกกับผู้ใช้แต่ละรายยังมีลำดับสูงกว่าเมนูหลัก</p>
        <p className="mt-2">ปุ่ม “บทความ/ข่าวสาร” ส่งข้อความ “บทความข่าวสาร” ซึ่งระบบปัจจุบันนำไปค้นหาทรัพย์ จึงยังไม่ได้เปิดบทความหรือข่าวสาร</p>
        <p className="mt-2">ผู้อื่นอาจเปลี่ยนการตั้งค่าระหว่างการตรวจสอบกับการตั้งค่าได้ หากเกิดข้อผิดพลาดหรือขาดการเชื่อมต่อ ผลอาจไม่แน่นอน อย่ากดซ้ำ ให้ตรวจสอบสถานะกับผู้ดูแลก่อนดำเนินการต่อ</p>
      </div>
      {status === 'ready' && !checkedEmpty && <p className="text-amber-800">กรุณากด “ตรวจการเชื่อมต่อ” และตรวจว่ารายการเมนู API และเมนูหลักจาก API ว่างก่อน</p>}
      {status === 'ready' && <form onSubmit={restore} className="space-y-3">
        <label htmlFor="line-restore-confirmation" className="block font-medium text-navy-950">พิมพ์ @930xzcyi เพื่อยืนยันการเปลี่ยนเมนูหลักจริง</label>
        <input id="line-restore-confirmation" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full max-w-sm rounded-xl border border-slate-300 px-3 py-2" />
        <button type="submit" disabled={!checkedEmpty || confirmation !== '@930xzcyi'} className="admin-primary disabled:opacity-50">ยืนยันสร้างและตั้งเมนูหลัก</button>
      </form>}
      {status === 'sending' && <p role="status">กำลังดำเนินการ กรุณาอย่าปิดหน้า หรือส่งคำขอซ้ำ</p>}
      {status === 'success' && <p role="status" className="text-emerald-700">ตั้งค่าและตรวจสอบเมนูหลักผ่าน API แล้ว กรุณากด “ตรวจการเชื่อมต่อ” อีกครั้ง และตรวจการแสดงผลใน LINE บนมือถือ</p>}
      {status === 'stopped' && <p role="alert" className="font-medium text-red-700">ไม่สามารถยืนยันผลได้ อาจมีการเปลี่ยนแปลงบางส่วนแล้ว อย่าลองซ้ำ กรุณากด “ตรวจการเชื่อมต่อ” อีกครั้งเพื่อตรวจสถานะ และให้ผู้ดูแลตรวจสอบก่อนดำเนินการต่อ</p>}
    </section>
  );
}
