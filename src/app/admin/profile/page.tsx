import React from 'react';
import type { Metadata } from 'next';
import ProfileEditor from '@/components/profile/ProfileEditor';

export const metadata: Metadata = {
  title: 'โปรไฟล์ผู้ดูแลระบบ | Chantakorn CRM',
  description: 'แก้ไขรูปภาพประจำตัวและข้อมูลส่วนตัวของผู้ดูแลระบบ Chantakorn Property',
};

export default function AdminProfilePage() {
  return (
    <div className="space-y-6">
      <ProfileEditor isAdminView={true} />
    </div>
  );
}
