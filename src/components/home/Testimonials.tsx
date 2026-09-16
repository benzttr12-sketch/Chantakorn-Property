import React from 'react';
import Image from 'next/image';
import { Star, Quote } from 'lucide-react';

export default function Testimonials() {
  const reviews = [
    {
      name: 'คุณธีรพงศ์ วัฒนพาณิชย์',
      role: 'เจ้าของธุรกิจ ควนลัง หาดใหญ่',
      comment: 'ฝากขายที่ดินกับ Chantakorn Property ทีมงานทำงานรวดเร็วมาก มีการคัดกรองผู้ซื้อจริงเข้ามาดูทรัพย์ ไม่รบกวนเวลาของเรา และประสานงานเอกสารกับสำนักงานที่ดินจนจบกระบวนการอย่างเรียบร้อย ประทับใจมากครับ',
      property: 'ขายที่ดิน 2 ไร่ โซนควนลัง',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      rating: 5,
    },
    {
      name: 'แพทย์หญิงศิริพร บุญยืน',
      role: 'อาจารย์แพทย์ รพ.สงขลานครินทร์ (ม.อ.)',
      comment: 'ได้บ้านเดี่ยวทำเลใกล้ ม.อ. ตามงบประมาณที่ตั้งไว้ คุณเบนซ์และทีมงานพาดูบ้านอย่างใจเย็น ให้ข้อมูลที่เป็นจริงเรื่องโครงสร้างและสิ่งแวดล้อม พร้อมช่วยประสานเรื่องสินเชื่อธนาคารได้ดอกเบี้ยดีมาก แนะนำเลยค่ะ',
      property: 'ซื้อบ้านเดี่ยว 2 ชั้น ใกล้เซ็นทรัลหาดใหญ่',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      rating: 5,
    },
    {
      name: 'คุณกิตติศักดิ์ พรหมมินทร์',
      role: 'นักลงทุนอสังหาริมทรัพย์ สงขลา',
      comment: 'ซื้ออพาร์ทเมนท์เพื่อการลงทุนผ่าน Chantakorn Property วิเคราะห์ผลตอบแทน Yield ได้แม่นยำ เอกสารสัญญาเช่าผู้เช่าเดิมเรียบร้อย ทำให้สามารถรับผลตอบแทนต่อเนื่องได้ตั้งแต่วันแรกที่โอน มืออาชีพตัวจริงครับ',
      property: 'ซื้ออพาร์ทเมนท์ให้เช่า ย่าน ม.อ.',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      rating: 5,
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-surface-bg border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gold-50 border border-gold-200 text-xs font-bold text-gold-700 uppercase tracking-wider mb-2">
            <span>เสียงตอบรับจากลูกค้าจริง (ตัวอย่างระบบ DEMO)</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-950">
            ความไว้วางใจจากลูกค้าของเรา
          </h2>
          <p className="text-brand-muted text-sm sm:text-base mt-2">
            เรามุ่งมั่นให้บริการด้วยความจริงใจ และสร้างผลลัพธ์ที่ดีที่สุดให้กับทุกท่าน
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((rev) => (
            <div
              key={rev.name}
              className="bg-white rounded-2xl p-7 border border-surface-border shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between relative"
            >
              <div className="absolute top-6 right-6 text-gold-400/20">
                <Quote className="w-8 h-8" />
              </div>

              <div>
                {/* Demo Pill */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-1">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-gold-400 text-gold-400" />
                    ))}
                  </div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    DEMO REVIEW
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed italic mb-6">
                  &ldquo;{rev.comment}&rdquo;
                </p>
              </div>

              {/* Reviewer Profile */}
              <div className="pt-4 border-t border-gray-100 flex items-center space-x-3">
                <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 border border-gold-400">
                  <Image
                    src={rev.avatar}
                    alt={rev.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-950">{rev.name}</h3>
                  <p className="text-xs text-brand-muted">{rev.role}</p>
                  <p className="text-[11px] text-gold-600 font-medium mt-0.5">{rev.property}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
