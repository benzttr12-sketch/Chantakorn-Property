'use client';

import { Database } from 'lucide-react';
import { dataBackend, isDemoMode, isDemoAuthEnabled } from '@/lib/backend';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-navy-950">ข้อมูลระบบ</h1>
        <p className="mt-2 text-sm text-brand-muted">ตรวจสอบโหมดที่เว็บไซต์กำลังใช้งาน</p>
      </div>
      <section className="space-y-4 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-navy-950"><Database className="h-5 w-5 text-gold-600" />แหล่งข้อมูลที่เลือก</h2>
        <p className="text-sm text-gray-700">{isDemoMode ? 'ข้อมูลตัวอย่างและพื้นที่จัดเก็บในเบราว์เซอร์' : dataBackend === 'supabase' ? 'Supabase' : 'Firebase Firestore'}</p>
        <p className="text-sm leading-relaxed text-gray-600">{isDemoMode ? 'ข้อมูลที่แก้ไขบันทึกเฉพาะเบราว์เซอร์นี้ ไม่เผยแพร่ให้ผู้เข้าชมคนอื่น และแบบฟอร์มยังไม่ส่งข้อความถึงทีมงาน' : 'เว็บไซต์ใช้ฐานข้อมูลที่กำหนด หากโหลดหรือบันทึกไม่ได้จะแสดงข้อผิดพลาด สถานะนี้ระบุการตั้งค่าและไม่ใช่ผลทดสอบการเชื่อมต่อ'}</p>
        <p className="text-sm text-gray-600">เข้าสู่ระบบตัวอย่าง: {isDemoAuthEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</p>
      </section>
      <section className="space-y-3 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-navy-950">ข้อมูลหน่วยงาน</h2>
        <p className="text-sm text-gray-700">CHANTAKORN PROPERTY · โทร 081-604-0097</p>
        <p className="text-sm leading-relaxed text-gray-600">การเปลี่ยนข้อมูลติดต่อและการตั้งค่าฐานข้อมูลต้องแก้ไขโครงการแล้วเผยแพร่เว็บไซต์ใหม่ หน้านี้แสดงข้อมูลสำหรับตรวจสอบเท่านั้น</p>
      </section>
    </div>
  );
}
