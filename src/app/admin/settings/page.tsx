'use client';

import { Database } from 'lucide-react';
import { dataBackend } from '@/lib/backend';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-navy-950">ข้อมูลระบบ</h1>
        <p className="mt-2 text-sm text-brand-muted">ตรวจสอบสถานะและระบบฐานข้อมูลของเว็บไซต์</p>
      </div>
      <section className="space-y-4 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-navy-950"><Database className="h-5 w-5 text-gold-600" />ระบบฐานข้อมูลและคลาวด์</h2>
        <p className="text-sm text-gray-700 font-semibold">{dataBackend === 'supabase' ? 'Supabase' : 'Firebase Firestore (Cloud Production)'}</p>
        <p className="text-sm leading-relaxed text-gray-600">
          เว็บไซต์เชื่อมต่อและบันทึกข้อมูลแบบเรียลไทม์ผ่านคลาวด์ ข้อมูลประกาศอสังหาริมทรัพย์ กล่องข้อความติดต่อ และโปรไฟล์ผู้ใช้งานจะถูกซิงค์ไปยังฐานข้อมูลจริง
        </p>
      </section>
      <section className="space-y-3 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-navy-950">ข้อมูลหน่วยงาน</h2>
        <p className="text-sm text-gray-700">CHANTAKORN PROPERTY · โทร 081-604-0097</p>
        <p className="text-sm leading-relaxed text-gray-600">การเปลี่ยนข้อมูลติดต่อและการตั้งค่าหลักของระบบสามารถจัดการได้ผ่านส่วนควบคุมของผู้ดูแลระบบ</p>
      </section>
    </div>
  );
}
