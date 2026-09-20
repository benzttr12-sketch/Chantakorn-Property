'use client';

import { Database } from 'lucide-react';
import { dataBackend } from '@/lib/backend';
import { isFirebaseConfigured } from '@/lib/firebase/client';

export default function AdminSettingsPage() {
  const usesFirebase = dataBackend === 'firebase';
  const usesEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

  return (
    <div className="max-w-4xl space-y-6 pb-20">
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-navy-950">ข้อมูลระบบ</h1>
        <p className="mt-2 text-sm text-brand-muted">การตั้งค่าฐานข้อมูลที่เว็บไซต์ใช้งาน</p>
      </div>
      <section className="space-y-4 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-navy-950"><Database className="h-5 w-5 text-gold-600" />ระบบฐานข้อมูลและคลาวด์</h2>
        <p className="text-sm text-gray-700 font-semibold">{usesFirebase ? usesEmulators ? 'Firebase Emulator Suite (เครื่องพัฒนา)' : 'Firebase Authentication และ Cloud Firestore' : 'โหมดแสดงตัวอย่างแบบอ่านอย่างเดียว'}</p>
        <p className="text-sm leading-relaxed text-gray-600">
          {usesFirebase
            ? isFirebaseConfigured
              ? 'กำหนดค่า Firebase แล้ว เว็บไซต์ใช้บริการนี้สำหรับบัญชีสมาชิก ประกาศอสังหาริมทรัพย์ ข้อความติดต่อ และโปรไฟล์ผู้ใช้ หน้านี้แสดงการตั้งค่าเท่านั้น การเชื่อมต่อและสิทธิ์จะถูกตรวจสอบเมื่อโหลดหรือบันทึกข้อมูล'
              : 'เลือกใช้ Firebase แต่การตั้งค่ายังไม่ครบ จึงยังไม่สามารถใช้งานฐานข้อมูลหรือบัญชีสมาชิกได้'
            : 'เว็บไซต์แสดงข้อมูลตัวอย่างจากเครื่อง ไม่บันทึกข้อมูลเข้าสู่ฐานข้อมูล และไม่เปิดให้เข้าสู่ระบบหรือจัดการข้อมูล'}
        </p>
        {usesFirebase && (
          <dl className="space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div><dt className="font-semibold text-gray-700">Firebase Project ID</dt><dd className="break-all text-gray-600">{process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ยังไม่ได้กำหนด'}</dd></div>
            <div><dt className="font-semibold text-gray-700">Firestore Database ID</dt><dd className="text-gray-600">{process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)'}</dd></div>
          </dl>
        )}
      </section>
      <section className="space-y-3 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-navy-950">ข้อมูลหน่วยงาน</h2>
        <p className="text-sm text-gray-700">CHANTAKORN PROPERTY · โทร 081-604-0097</p>
        <p className="text-sm leading-relaxed text-gray-600">หน้านี้แสดงข้อมูลระบบเท่านั้น การเปลี่ยนข้อมูลติดต่อหรือการตั้งค่า Firebase ต้องให้ผู้ดูแลเว็บไซต์แก้ไขการตั้งค่าและเผยแพร่เว็บไซต์ใหม่</p>
      </section>
    </div>
  );
}
