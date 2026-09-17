import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-surface-bg">
      <div className="max-w-md w-full text-center bg-white p-8 sm:p-10 rounded-3xl border border-surface-border shadow-card">
        <span className="text-4xl font-extrabold text-gold-600 block mb-2">404</span>
        <h1 className="text-2xl font-extrabold text-navy-950 mb-2">
          ไม่พบหน้าที่คุณต้องการ
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
          หน้าที่คุณกำลังค้นหาอาจถูกย้าย ลบ หรือไม่มีอยู่ในระบบ Chantakorn Property
        </p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all"
        >
          <Home className="w-4 h-4" />
          <span>กลับสู่หน้าแรก</span>
        </Link>
      </div>
    </div>
  );
}
