import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import FloatingLineButton from '@/components/layout/FloatingLineButton';
import { SpeedInsights } from '@vercel/speed-insights/next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: {
    template: '%s | CHANTAKORN PROPERTY หาดใหญ่ สงขลา',
    default: 'CHANTAKORN PROPERTY | ซื้อ ขาย เช่า ฝากขาย บ้าน ที่ดิน คอนโด หาดใหญ่–สงขลา',
  },
  description: 'ฉันทากร พร็อพเพอร์ตี้ นายหน้าอสังหาริมทรัพย์มืออาชีพในหาดใหญ่-สงขลา บริการรับฝากขาย ฝากเช่า บ้านเดี่ยว ที่ดิน คอนโดมิเนียม อาคารพาณิชย์ และบริการขายฝากจำนอง ดูแลทุกขั้นตอนอย่างจริงใจและโปร่งใส',
  keywords: [
    'บ้านเดี่ยวหาดใหญ่',
    'ที่ดินหาดใหญ่',
    'คอนโดหาดใหญ่',
    'อสังหาริมทรัพย์สงขลา',
    'ฝากขายบ้านหาดใหญ่',
    'เช่าบ้านหาดใหญ่',
    'นายหน้าหาดใหญ่',
    'Chantakorn Property',
    'ฉันทากร พร็อพเพอร์ตี้'
  ],
  authors: [{ name: 'CHANTAKORN PROPERTY' }],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'CHANTAKORN PROPERTY | นายหน้าอสังหาริมทรัพย์ หาดใหญ่–สงขลา',
    description: 'บ้าน • ที่ดิน • คอนโด • อสังหาริมทรัพย์ ครบวงจร ใส่ใจทุกบริการ เราดูแลคุณเหมือนบ้านของเราเอง',
    url: siteUrl,
    siteName: 'CHANTAKORN PROPERTY',
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CHANTAKORN PROPERTY | หาดใหญ่–สงขลา',
    description: 'บริการซื้อ ขาย เช่า ฝากขาย อสังหาริมทรัพย์ในหาดใหญ่-สงขลา',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="bg-surface-bg text-brand-text flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
        <MobileBottomNav />
        <FloatingLineButton />
        <SpeedInsights />
      </body>
    </html>
  );
}
