import React from 'react';
import type { Metadata } from 'next';
import ProfileEditor from '@/components/profile/ProfileEditor';

export const metadata: Metadata = {
  title: 'โปรไฟล์ส่วนตัวและแก้ไขข้อมูล | Chantakorn Property',
  description: 'จัดการโปรไฟล์ส่วนตัว แก้ไขรูปภาพประจำตัว เบอร์ติดต่อ และข้อมูลผู้ใช้งานระบบ Chantakorn Property หาดใหญ่ สงขลา',
};

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-surface-subtle py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ProfileEditor isAdminView={false} />
      </div>
    </div>
  );
}
