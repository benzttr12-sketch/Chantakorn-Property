import React from 'react';
import { Award, FileCheck2, Handshake, MapPin, ShieldCheck, Sparkles } from 'lucide-react';

export default function WhyChooseUs() {
  const reasons = [
    {
      icon: Award,
      title: 'มืออาชีพ & จริงใจ',
      description: 'ทีมงานผู้เชี่ยวชาญด้านอสังหาริมทรัพย์ ประเมินราคาอย่างเป็นกลาง และพร้อมดูแลด้วยความจริงใจสูงสุด',
    },
    {
      icon: FileCheck2,
      title: 'ข้อมูลชัดเจน ถูกต้อง 100%',
      description: 'ตรวจสอบความถูกต้องของเอกสารสิทธิ์ โฉนดที่ดิน และภาระผูกพันอย่างละเอียด ไร้กังวลเรื่องหนี้ซ้อน',
    },
    {
      icon: Handshake,
      title: 'ดูแลครบทุกขั้นตอน',
      description: 'ดูแลตั้งแต่การนัดชมทรัพย์ เจรจาต่อรอง ประสานงานสินเชื่อธนาคาร จนถึงการโอนกรรมสิทธิ์ ณ สำนักงานที่ดิน',
    },
    {
      icon: MapPin,
      title: 'เชี่ยวชาญพื้นที่หาดใหญ่–สงขลา',
      description: 'เข้าใจทำเลและราคาตลาดอย่างแท้จริง ทั้งโซน ม.อ. เซ็นทรัลหาดใหญ่ สนามบิน คลองแห บ้านพรุ และตัวเมืองสงขลา',
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-[#020812] text-white relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-navy-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/10 border border-gold-400/30 text-gold-300 text-xs font-bold mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span>ทำไมต้องเลือกเรา</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            มาตรฐานการบริการระดับมืออาชีพ
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-3 max-w-2xl mx-auto">
            Chantakorn Property มุ่งมั่นดูแลทุกการซื้อ ขาย เช่า ฝากขาย และขายฝาก ด้วยความโปร่งใส ปลอดภัย และผลประโยชน์สูงสุดของลูกค้า
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reasons.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white/[0.04] border border-white/10 hover:border-gold-400/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.07] group flex flex-col justify-between backdrop-blur-sm"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 mb-6 group-hover:bg-gold-400 group-hover:text-navy-950 transition-all duration-300">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="text-gold-400/80 font-mono text-xs font-bold mb-1">0{idx + 1}</div>
                  <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-gold-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
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
