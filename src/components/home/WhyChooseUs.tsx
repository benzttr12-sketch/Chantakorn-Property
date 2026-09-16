import React from 'react';
import { Award, FileCheck2, Handshake, MapPin } from 'lucide-react';

export default function WhyChooseUs() {
  const reasons = [
    {
      icon: Award,
      title: 'มืออาชีพ',
      description: 'ทีมงานมืออาชีพมีความเชี่ยวชาญด้านอสังหาริมทรัพย์ ประเมินราคาอย่างเป็นกลาง และดูแลด้วยความจริงใจ',
    },
    {
      icon: FileCheck2,
      title: 'ข้อมูลชัดเจน',
      description: 'ตรวจสอบความถูกต้องของเอกสารสิทธิ์ โฉนดที่ดิน ภาระผูกพัน และราคาตลาดอย่างโปร่งใส ไร้กังวล',
    },
    {
      icon: Handshake,
      title: 'ดูแลทุกขั้นตอน',
      description: 'ดูแลตั้งแต่การนัดชมทรัพย์ การเจรจาต่อรอง การยื่นขอสินเชื่อธนาคาร จนถึงการโอนกรรมสิทธิ์ ณ สำนักงานที่ดิน',
    },
    {
      icon: MapPin,
      title: 'รู้จักพื้นที่หาดใหญ่–สงขลา',
      description: 'เชี่ยวชาญทำเลท้องถิ่นอย่างแท้จริง ทั้งโซน ม.อ. เซ็นทรัลหาดใหญ่ สนามบิน คลองแห บ้านพรุ และตัวเมืองสงขลา',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-navy-950 text-white relative overflow-hidden">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#C9A227_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-gold-400 uppercase tracking-widest bg-navy-900 border border-gold-500/30 px-3.5 py-1 rounded-full">
            จุดเด่นและความไว้วางใจ
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 mb-4">
            ทำไมต้อง Chantakorn Property?
          </h2>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            เรามุ่งมั่นให้บริการนายหน้าอสังหาริมทรัพย์ด้วยมาตรฐานสูงสุด เพื่อให้ทุกการซื้อ ขาย เช่า หรือลงทุนของคุณราบรื่นและปลอดภัยที่สุด
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reasons.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-navy-900/80 border border-navy-800 hover:border-gold-500/40 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover group flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 mb-5 group-hover:bg-gold-500 group-hover:text-navy-950 transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-gold-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
