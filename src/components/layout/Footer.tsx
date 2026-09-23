'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  MessageCircle, 
  Facebook,
  ExternalLink
} from 'lucide-react';
import { fetchProperties } from '@/lib/store/properties-store';
import { SAMPLE_PROPERTIES } from '@/data/sample-properties';

// คำนวณทำเลเริ่มต้นจากข้อมูลจริง
function getInitialDistricts() {
  const map: Record<string, number> = {};
  SAMPLE_PROPERTIES.forEach((p) => {
    if (p.published !== false && p.district?.trim()) {
      const d = p.district.trim();
      map[d] = (map[d] || 0) + 1;
    }
  });
  return Object.entries(map).map(([district, count]) => ({ district, count }));
}

export default function Footer() {
  const [districts, setDistricts] = useState<{ district: string; count: number }[]>(getInitialDistricts);
  const [totalProperties, setTotalProperties] = useState<number>(SAMPLE_PROPERTIES.length);

  useEffect(() => {
    let isMounted = true;
    async function loadRealData() {
      try {
        const props = await fetchProperties();
        if (!isMounted) return;
        const countsMap: Record<string, number> = {};
        props.forEach((p) => {
          const d = p.district?.trim();
          if (d) {
            countsMap[d] = (countsMap[d] || 0) + 1;
          }
        });
        const list = Object.entries(countsMap)
          .map(([district, count]) => ({ district, count }))
          .sort((a, b) => b.count - a.count);

        setDistricts(list);
        setTotalProperties(props.length);
      } catch {
        // ใช้ข้อมูลเริ่มต้น
      }
    }
    loadRealData();
    return () => {
      isMounted = false;
    };
  }, []);
  return (
    <footer className="bg-navy-950 text-gray-300 pt-16 pb-24 md:pb-12 border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-navy-800/80">
          {/* Col 1: Brand & Bio */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-bold shadow-md">
                <Building2 className="w-6 h-6 text-navy-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-xl tracking-wider leading-none">
                  CHANTAKORN
                </span>
                <span className="text-gold-400 text-xs font-semibold tracking-widest leading-tight">
                  PROPERTY
                </span>
              </div>
            </Link>

            <p className="text-sm text-gray-300 leading-relaxed max-w-sm pt-2">
              นายหน้าอสังหาริมทรัพย์ครบวงจรในพื้นที่ <strong className="text-white font-semibold">หาดใหญ่ – สงขลา</strong> บริการรับฝากขาย ฝากเช่า ซื้อ ขาย จัดหาบ้าน ที่ดิน คอนโด และขายฝากจำนอง ด้วยความจริงใจ โปร่งใส และเป็นมืออาชีพ
            </p>

            <div className="p-3.5 bg-navy-900/90 border border-gold-500/20 rounded-xl max-w-sm">
              <p className="text-xs text-gold-300 font-medium italic">
                &ldquo;บ้าน • ที่ดิน • คอนโด • อสังหาริมทรัพย์ ครบวงจร ใส่ใจทุกบริการ เราดูแลคุณเหมือนบ้านของเราเอง&rdquo;
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <a
                href="https://lin.ee/NMSe28T3"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-navy-800 hover:bg-[#06C755] flex items-center justify-center text-white transition-colors"
                title="LINE Official"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-navy-800 hover:bg-[#1877F2] flex items-center justify-center text-white transition-colors"
                title="Facebook: Chantakorn Property นายหน้า บ้าน ที่ดิน คอนโด หาดใหญ่ สงขลา"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="tel:0816040097"
                className="w-9 h-9 rounded-full bg-navy-800 hover:bg-gold-500 hover:text-navy-950 flex items-center justify-center text-white transition-colors"
                title="โทรหาเรา"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2: Services */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-gold-500 pl-2">
              บริการของเรา
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/services#sell" className="hover:text-gold-400 transition-colors">
                  รับฝากขายบ้านและที่ดิน
                </Link>
              </li>
              <li>
                <Link href="/services#rent" className="hover:text-gold-400 transition-colors">
                  บริการจัดหาผู้เช่า / ฝากเช่า
                </Link>
              </li>
              <li>
                <Link href="/buy" className="hover:text-gold-400 transition-colors">
                  ซื้อบ้าน คอนโด ที่ดิน
                </Link>
              </li>
              <li>
                <Link href="/services#consignment" className="hover:text-gold-400 transition-colors">
                  บริการขายฝาก / จำนอง
                </Link>
              </li>
              <li>
                <Link href="/services#consult" className="hover:text-gold-400 transition-colors">
                  ปรึกษาประเมินราคา & สินเชื่อ
                </Link>
              </li>
              <li>
                <Link href="/sell" className="text-gold-400 font-medium hover:underline flex items-center">
                  ฝากขายทรัพย์กับเรา
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Areas in Songkhla (แสดงเฉพาะข้อมูลจริงที่มีอยู่) */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-gold-500 pl-2">
              ทำเลยอดนิยม
            </h3>
            <ul className="space-y-2 text-sm">
              {districts.length > 0 ? (
                districts.map((item) => (
                  <li key={item.district}>
                    <Link
                      href={`/properties?district=${encodeURIComponent(item.district)}`}
                      className="hover:text-gold-400 transition-colors flex justify-between items-center"
                    >
                      <span>{item.district}</span>
                      <span className="text-gray-400 text-xs font-semibold">{item.count} รายการ</span>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-gray-500 text-xs py-1">
                  <span>ยังไม่มีรายการในขณะนี้</span>
                </li>
              )}
              <li className="pt-2 border-t border-navy-800/80">
                <Link
                  href="/properties"
                  className="text-gold-400 hover:text-gold-300 transition-colors flex justify-between items-center text-xs font-medium"
                >
                  <span>ดูทรัพย์สินทั้งหมด</span>
                  <span className="text-gold-400/90 font-bold">{totalProperties} รายการ</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact Info */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4 border-l-2 border-gold-500 pl-2">
              ติดต่อสำนักงาน
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-gold-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300 text-xs leading-relaxed">
                  สำนักงาน ฉันทากร พร็อพเพอร์ตี้ อ.หาดใหญ่ จ.สงขลา 90110
                </span>
              </li>
              <li className="flex items-center space-x-2.5">
                <Phone className="w-4 h-4 text-gold-400 flex-shrink-0" />
                <a href="tel:0816040097" className="hover:text-gold-400 font-semibold text-white">
                  081-604-0097
                </a>
              </li>
              <li className="flex items-center space-x-2.5">
                <MessageCircle className="w-4 h-4 text-[#06C755] flex-shrink-0" />
                <span className="text-gray-300">
                  LINE: <strong className="text-white">Official Account</strong>
                </span>
              </li>
              <li className="flex items-center space-x-2.5">
                <Facebook className="w-4 h-4 text-[#1877F2] flex-shrink-0" />
                <a
                  href="https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-gold-400 text-xs text-gray-300"
                >
                  Facebook: <strong className="text-white">Chantakorn Property</strong>
                </a>
              </li>
              <li className="flex items-center space-x-2.5">
                <Mail className="w-4 h-4 text-gold-400 flex-shrink-0" />
                <a href="mailto:contact@chantakornproperty.com" className="hover:text-gold-400 text-xs">
                  contact@chantakornproperty.com
                </a>
              </li>
              <li className="flex items-center space-x-2.5">
                <Clock className="w-4 h-4 text-gold-400 flex-shrink-0" />
                <span className="text-gray-400 text-xs">
                  เปิดทำการ: ทุกวัน 08:30 – 18:00 น.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Credits */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-gray-400 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-gold-400" />
            <span>© {new Date().getFullYear()} CHANTAKORN PROPERTY. All rights reserved. บริการนายหน้าอสังหาริมทรัพย์ หาดใหญ่–สงขลา</span>
          </div>

          <div className="flex items-center space-x-6 text-gray-400">
            <Link href="/about" className="hover:text-white transition-colors">
              เกี่ยวกับเรา
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              แผนที่ติดต่อ
            </Link>
            <Link href="/admin" className="hover:text-gold-400 transition-colors">
              เข้าสู่ระบบเจ้าหน้าที่
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
