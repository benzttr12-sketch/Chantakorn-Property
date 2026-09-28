import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Key, 
  Search, 
  Handshake, 
  Landmark, 
  FileText, 
  Eye, 
  Award,
  ArrowRight,
  PhoneCall,
  CheckCircle2
} from 'lucide-react';

export default function ServicesPage() {
  const services = [
    {
      id: 'sell',
      icon: Building2,
      title: '1. รับฝากขายบ้านและที่ดินครบวงจร',
      description: 'บริการบริหารการตลาดอสังหาริมทรัพย์ระดับพรีเมียม ทั้งภาพถ่ายคุณภาพสูง สื่อโฆษณาดิจิทัลเจาะกลุ่มเป้าหมาย และป้ายประกาศทำเลเด่น คัดกรองผู้ซื้อตัวจริงที่มีศักยภาพทางการเงิน ช่วยปิดการขายอย่างราบรื่นในราคาที่เป็นธรรม',
      ctaText: 'ฝากขายกับเรา',
      ctaLink: '/sell',
    },
    {
      id: 'rent',
      icon: Key,
      title: '2. รับฝากเช่าและจัดหาผู้เช่าคุณภาพ',
      description: 'บริการคัดสรรผู้เช่าคุณภาพสำหรับบ้าน พูลวิลล่า และคอนโดมิเนียม โดยเฉพาะทำเลศักยภาพใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.) และเซ็นทรัลหาดใหญ่ พร้อมดูแลร่างสัญญาเช่าที่เป็นธรรมและตรวจรับมอบห้องอย่างละเอียด',
      ctaText: 'ลงประกาศฝากเช่า',
      ctaLink: '/sell',
    },
    {
      id: 'buy',
      icon: Search,
      title: '3. จัดหาบ้าน ที่ดิน และคอนโดมิเนียมตามความต้องการ',
      description: 'ให้คำปรึกษาและเฟ้นหาอสังหาริมทรัพย์ที่ตอบโจทย์ไลฟ์สไตล์และงบประมาณของคุณ ตรวจสอบสถานะทางกฎหมาย โฉนดที่ดิน ระวาง และภาระผูกพันอย่างรอบคอบ เพื่อความปลอดภัยสูงสุดในทุกการครอบครอง',
      ctaText: 'ค้นหาอสังหาฯ',
      ctaLink: '/properties',
    },
    {
      id: 'consignment',
      icon: Handshake,
      title: '4. บริการขายฝากและเสริมสภาพคล่องทางการเงิน',
      description: 'จัดหาเงินทุนหมุนเวียนด่วนอย่างถูกต้องตามกฎหมาย จดทะเบียนนิติกรรมสัญญา ณ สำนักงานที่ดิน ดอกเบี้ยเป็นธรรมตามกรอบกฎหมาย วงเงินสูง อนุมัติรวดเร็ว ปลอดภัย และโปร่งใสในทุกขั้นตอน',
      ctaText: 'ปรึกษาเรื่องขายฝาก',
      ctaLink: '/contact',
    },
    {
      id: 'mortgage',
      icon: Landmark,
      title: '5. บริการที่ปรึกษาด้านจำนองและสินเชื่อ',
      description: 'ให้คำปรึกษาการนำอสังหาริมทรัพย์มาเป็นหลักประกันเงินกู้ ทั้งกับสถาบันการเงินพันธมิตรและแหล่งเงินทุนที่ถูกกฎหมาย วางแผนการผ่อนชำระที่สอดคล้องกับสภาพคล่องเพื่อประโยชน์สูงสุดของลูกค้า',
      ctaText: 'สอบถามรายละเอียด',
      ctaLink: '/contact',
    },
    {
      id: 'consult',
      icon: Award,
      title: '6. บริการที่ปรึกษาการลงทุนอสังหาริมทรัพย์',
      description: 'วิเคราะห์ศักยภาพทำเล ประเมินราคาตลาดจริง และคำนวณผลตอบแทนจากการลงทุน (Rental Yield & Capital Gain) อย่างแม่นยำ เพื่อสร้างความมั่งคั่งและเสถียรภาพทางการเงินในระยะยาว',
      ctaText: 'ขอรับคำปรึกษาฟรี',
      ctaLink: '/contact',
    },
    {
      id: 'document',
      icon: FileText,
      title: '7. บริการประสานงานสถาบันการเงินและนิติกรรมสัญญา',
      description: 'ประสานงานกับสถาบันการเงินพันธมิตรชั้นนำในการยื่นขอสินเชื่อที่อยู่อาศัย เปรียบเทียบอัตราดอกเบี้ยและเงื่อนไขที่ดีที่สุด พร้อมจัดเตรียมเอกสารนิติกรรมสัญญา ณ สำนักงานที่ดินอย่างถูกต้องสมบูรณ์',
      ctaText: 'ปรึกษาสินเชื่อ',
      ctaLink: '/contact',
    },
    {
      id: 'viewing',
      icon: Eye,
      title: '8. อำนวยความสะดวกนำชมทรัพย์และการเจรจาต่อรอง',
      description: 'นำชมสถานที่จริง ให้ข้อมูลเชิงลึกเกี่ยวกับตัวทรัพย์ สภาพแวดล้อม และผังเมือง พร้อมทำหน้าที่คนกลางในการเจรจาต่อรองเงื่อนไขที่เป็นธรรม สร้างความพึงพอใจและความไว้วางใจแก่ทั้งสองฝ่าย',
      ctaText: 'นัดหมายเข้าชม',
      ctaLink: '/properties',
    },
  ];

  return (
    <div className="bg-surface-bg min-h-screen pb-24">
      {/* Banner */}
      <div className="bg-navy-950 text-white py-16 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <span className="inline-block text-xs font-bold text-gold-400 uppercase tracking-widest bg-navy-900 border border-gold-500/30 px-3.5 py-1 rounded-full mb-3">
            บริการเอกสิทธิ์ระดับมืออาชีพ
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white">
            บริการของเรา
          </h1>
          <p className="text-gray-300 text-sm sm:text-base mt-3 leading-relaxed">
            CHANTAKORN PROPERTY มุ่งมั่นส่งมอบบริการด้านอสังหาริมทรัพย์ครบวงจรในพื้นที่หาดใหญ่–สงขลา ด้วยความซื่อตรง โปร่งใส และความเป็นมืออาชีพในทุกขั้นตอน
          </p>
        </div>
      </div>

      {/* Services Grid (8 Services) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                id={item.id}
                className="bg-white rounded-2xl p-7 border border-surface-border shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-navy-50 group-hover:bg-gold-500 group-hover:text-navy-950 text-navy-900 flex items-center justify-center transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-navy-950 group-hover:text-navy-800">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-brand-muted flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                    มาตรฐาน Chantakorn Property
                  </span>

                  <Link
                    href={item.ctaLink}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-navy-950 group-hover:bg-gold-500 text-gold-400 group-hover:text-navy-950 text-xs font-bold rounded-lg transition-all"
                  >
                    <span>{item.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Contact Callout */}
        <div className="mt-16 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 rounded-3xl p-8 sm:p-12 text-center text-white border border-navy-800 shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            ต้องการคำปรึกษาเฉพาะด้านเกี่ยวกับอสังหาริมทรัพย์ของคุณ?
          </h2>
          <p className="text-gray-300 text-sm max-w-xl mx-auto mb-6">
            ทีมงานพร้อมให้คำแนะนำและประเมินราคาเบื้องต้นโดยไม่มีค่าใช้จ่าย โทรคุยกับเราได้ทันที
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="tel:0816040097"
              className="px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 font-bold text-sm rounded-xl shadow-md flex items-center space-x-2"
            >
              <PhoneCall className="w-4 h-4 text-navy-950" />
              <span>โทร 081-604-0097</span>
            </a>
            <Link
              href="/contact"
              className="px-6 py-3 bg-navy-800 hover:bg-navy-700 text-white font-semibold text-sm rounded-xl border border-white/20"
            >
              ติดต่อสำนักงาน
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
