import React from 'react';
import { Award, FileCheck2, Handshake, MapPin, Sparkles } from 'lucide-react';

export default function WhyChooseUs() {
  const reasons = [
    {
      num: '01',
      icon: FileCheck2,
      title: 'ตรวจสอบโฉนด & เอกสารสิทธิ์ 100%',
      description: 'ตรวจสอบความถูกต้องของโฉนดที่ดิน ระวางที่ดิน และภาระผูกพันอย่างละเอียด ไร้ข้อพิพาท ไร้ภาระหนี้ซ้อน ปลอดภัยสูงสุดในทุกนิติกรรมสัญญา',
      badge: 'VERIFIED TITLE DEED',
    },
    {
      num: '02',
      icon: Award,
      title: 'ที่ปรึกษาสินเชื่อครบวงจร วงเงินสูงสุด',
      description: 'ประสานงานตรงกับสถาบันการเงินพันธมิตรชั้นนำ มอบอัตราดอกเบี้ยและเงื่อนไขพิเศษเฉพาะลูกค้าเรา พร้อมวิเคราะห์วางแผนดันเคสให้ได้รับวงเงินสูงสุด',
      badge: 'LOAN PARTNERSHIP',
    },
    {
      num: '03',
      icon: MapPin,
      title: 'เชี่ยวชาญทำเลทองหาดใหญ่–สงขลา อย่างแท้จริง',
      description: 'หยั่งลึกทุกมิติราคาตลาดจริงและศักยภาพการเติบโต ทั้งโซน ม.อ. คอหงส์ เซ็นทรัลหาดใหญ่ โซนสนามบิน และเมืองสงขลา',
      badge: 'LOCAL EXPERTISE',
    },
    {
      num: '04',
      icon: Handshake,
      title: 'เคียงข้างและดูแลจนถึงวันส่งมอบกรรมสิทธิ์',
      description: 'บริการระดับเอกสิทธิ์ในทุกย่างก้าว ตั้งแต่วันนัดชมทรัพย์ เจรจาต่อรองบนความยุติธรรม นิติกรรมสัญญา จนถึงวันส่งมอบกุญแจ ณ สำนักงานที่ดิน',
      badge: 'FULL SERVICE CARE',
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-[#020812] text-white relative overflow-hidden">
      {/* Ambient Lighting & Glows */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gold-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-navy-800/30 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="flex items-center justify-center space-x-2 text-xs font-bold text-gold-400 uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span>ทำไมต้องเลือก ฉันทากร พร็อพเพอร์ตี้</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight text-balance">
            เหตุผลที่ลูกค้าไว้วางใจให้เราดูแลบ้านและที่ดิน
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-3 max-w-2xl mx-auto font-normal">
            บริการนายหน้าอสังหาริมทรัพย์ด้วยความซื่อสัตย์ โปร่งใส สัญญาชัดเจน และพร้อมอยู่ดูแลเคียงข้างคุณทุกขั้นตอน
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {reasons.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white/[0.04] border border-white/10 hover:border-gold-400/60 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.08] group flex flex-col justify-between backdrop-blur-sm shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400 group-hover:bg-gold-400 group-hover:text-navy-950 transition-all duration-300 shadow-md">
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="font-mono text-xs font-black text-gold-400/80 tracking-widest">
                      {item.num}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider block mb-2">
                    {item.badge}
                  </span>

                  <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-gold-300 transition-colors leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
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
