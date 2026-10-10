'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import FloatingLineButton from './FloatingLineButton';
import CompareBar from '@/components/compare/CompareBar';

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return <>{children}</>;

  return (
    <>
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
      <CompareBar />
      <MobileBottomNav />
      <FloatingLineButton />
    </>
  );
}
