import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Building2, 
  ShieldCheck, 
  HeartHandshake, 
  CheckCircle2, 
  Award, 
  Users, 
  MapPin, 
  Phone, 
  MessageCircle,
  Facebook,
  Clock
} from 'lucide-react';
import { AGENTS } from '@/data/agents';
import { formatFacebookUrl, formatLineUrl } from '@/lib/utils';

export default function AboutPage() {
  const coreValues = [
    {
      title: 'ความจริงใจ (Sincerity)',
      description: 'เราดำเนินธุรกิจด้วยความซื่อสัตย์ ให้ข้อมูลข้อเท็จจริงอย่างตรงไปตรงมา ไม่ปิดบัง ไม่ชวนเชื่อเกินจริง เพื่อให้ลูกค้าได้ทรัพย์ที่ตรงกับความต้องการและคุ้มค่าที่สุด',
      icon: HeartHandshake,
    },
    {
      title: 'ความโปร่งใส (Transparency)',
      description: 'ตรวจสอบความถูกต้องของเอกสารสิทธิ์ โฉนดที่ดิน ภาระผูกพัน และราคาตลาดจริง เปิดเผยค่าใช้จ่ายในการโอนและภาษีอย่างชัดเจน ไม่มีค่าใช้จ่ายแอบแฝง',
      icon: ShieldCheck,
    },
    {
      title: 'ความเป็นมืออาชีพ (Professionalism)',
      description: 'ทีมงานผ่านการอบรมและมีประสบการณ์ลึกซึ้งในวงการอสังหาริมทรัพย์หาดใหญ่และสงขลา เชี่ยวชาญการตั้งราคา การตลาด การเจรจา และนิติกรรมสัญญา',
      icon: Award,
    },
    {
      title: 'ดูแลตั้งแต่ต้นจนจบ (End-to-End Service)',
      description: 'เราอยู่เคียงข้างคุณในทุกย่างก้าว ตั้งแต่วันแรกที่พานัดชมทรัพย์ เจรจาต่อรอง ประสานงานยื่นกู้สินเชื่อธนาคาร จนถึงวันโอนกรรมสิทธิ์ ณ สำนักงานที่ดิน',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="bg-surface-bg min-h-screen pb-24">
      {/* Banner */}
      <div className="bg-navy-950 text-white py-16 lg:py-24 border-b border-navy-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#C9A227_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-navy-900 border border-gold-500/30 text-gold-400 text-xs font-semibold mb-4">
            <Building2 className="w-3.5 h-3.5 text-gold-400" />
            <span>เกี่ยวกับเรา</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Chantakorn Property
          </h1>

          <p className="text-xl sm:text-2xl text-gold-400 font-semibold mb-4">
            นายหน้าอสังหาริมทรัพย์ หาดใหญ่ – สงขลา
          </p>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed font-light">
            &ldquo;บ้าน • ที่ดิน • คอนโด • อสังหาริมทรัพย์ ครบวงจร ใส่ใจทุกบริการ เราดูแลคุณ เหมือนบ้านของเราเอง&rdquo;
          </p>
        </div>
      </div>

      {/* Brand Story Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="text-xs font-bold text-gold-600 uppercase tracking-widest bg-gold-50 px-3.5 py-1 rounded-full border border-gold-200">
              เรื่องราวของเรา
            </span>
            <h2 className="text-3xl font-extrabold text-navy-950 leading-tight">
              ที่ปรึกษาอสังหาริมทรัพย์ที่คุณวางใจได้ในทุกการตัดสินใจ
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong>CHANTAKORN PROPERTY (ฉันทากร พร็อพเพอร์ตี้)</strong> ก่อตั้งขึ้นด้วยเจตนารมณ์ในการยกระดับมาตรฐานการให้บริการนายหน้าอสังหาริมทรัพย์ในเขตอำเภอหาดใหญ่และจังหวัดสงขลา เพื่อให้ผู้ซื้อ ผู้ขาย และผู้เช่า ได้รับบริการที่ปลอดภัย มีคุณภาพ และสบายใจที่สุด
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              เราตระหนักดีว่าการซื้อขายบ้านหรือที่ดินมูลค่าหลักล้านบาท คือหนึ่งในการตัดสินใจทางการเงินที่สำคัญที่สุดในชีวิตของลูกค้า เราจึงทุ่มเทและใส่ใจในทุกรายละเอียด ตั้งแต่การคัดสรรทรัพย์ การประเมินราคาตามหลักวิชาชีพ การวิเคราะห์ทำเล ไปจนถึงการตรวจเช็คเอกสารสิทธิ์ให้ถูกต้องสมบูรณ์
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div className="p-4 bg-white rounded-2xl border border-surface-border shadow-xs">
                <div className="text-2xl font-extrabold text-gold-600">10+ ปี</div>
                <div className="text-xs text-gray-600 mt-1">ประสบการณ์ในพื้นที่หาดใหญ่–สงขลา</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-surface-border shadow-xs">
                <div className="text-2xl font-extrabold text-navy-950">500+ ล้าน</div>
                <div className="text-xs text-gray-600 mt-1">มูลค่าทรัพย์ที่ดูแลและปิดการขายสำเร็จ</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              <Image
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1000&q=80"
                alt="Chantakorn Property Office Team"
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-navy-950 text-white p-6 rounded-2xl shadow-xl max-w-xs border border-navy-800 hidden sm:block">
              <div className="flex items-center space-x-2 text-gold-400 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-bold">Hat Yai, Songkhla</span>
              </div>
              <p className="text-xs text-gray-300">
                เชี่ยวชาญผังเมือง ทำเล ม.อ., เซ็นทรัลหาดใหญ่, สนามบิน, และเมืองสงขลา
              </p>
            </div>
          </div>
        </div>

        {/* Core Values (4 Pillars) */}
        <div className="mt-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-gold-600 uppercase tracking-widest bg-gold-50 px-3.5 py-1 rounded-full border border-gold-200">
              ค่านิยมหลัก
            </span>
            <h2 className="text-3xl font-extrabold text-navy-950 mt-2">
              4 เสาหลักในการบริการของเรา
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((v) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.title}
                  className="bg-white rounded-2xl p-6 border border-surface-border shadow-card flex flex-col justify-between hover:shadow-card-hover transition-all"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-gold-50 text-gold-600 border border-gold-200 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-navy-950 mb-2">
                      {v.title}
                    </h3>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Members Section */}
        <div className="mt-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-gold-600 uppercase tracking-widest bg-gold-50 px-3.5 py-1 rounded-full border border-gold-200">
              โปรไฟล์ที่ปรึกษาและทีมงาน
            </span>
            <h2 className="text-3xl font-extrabold text-navy-950 mt-2">
              ที่ปรึกษาและทีมงาน Chantakorn Property
            </h2>
            <p className="text-xs sm:text-sm text-brand-muted mt-1">
              ทีมงานได้รับการแบ่งหน้าที่ตามยศอย่างชัดเจน: <strong>แอดมิน</strong> และ <strong>นายหน้า</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {AGENTS.map((agent) => {
              const isAdmin = agent.rank === 'แอดมิน';
              return (
                <div
                  key={agent.id}
                  className="bg-white rounded-2xl p-6 border border-surface-border shadow-card flex flex-col justify-between hover:shadow-card-hover transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5">
                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-gold-400 flex-shrink-0 shadow-md">
                      <Image
                        src={agent.photo_url}
                        alt={agent.name}
                        fill
                        unoptimized
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="flex-grow text-center sm:text-left">
                      <h3 className="text-base sm:text-lg font-bold text-navy-950">{agent.name}</h3>
                      
                      {/* Strict Rank Badge */}
                      <div className="mt-1.5 flex justify-center sm:justify-start">
                        <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          isAdmin 
                            ? 'bg-gold-50 text-gold-900 border-gold-300' 
                            : 'bg-navy-50 text-navy-900 border-navy-200'
                        }`}>
                          {isAdmin ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-gold-600" />
                              <span>ยศ: แอดมิน (Admin)</span>
                            </>
                          ) : (
                            <>
                              <Award className="w-3.5 h-3.5 text-navy-700" />
                              <span>ยศ: นายหน้า (Agent)</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                        {agent.bio}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs gap-2">
                    <a
                      href={`tel:${agent.phone}`}
                      className="font-bold text-navy-950 hover:text-gold-600 flex items-center space-x-1 py-1"
                    >
                      <Phone className="w-3.5 h-3.5 text-gold-600" />
                      <span>{agent.phone}</span>
                    </a>

                    <div className="flex items-center space-x-2">
                      <a
                        href={formatLineUrl(agent.line_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 flex items-center space-x-1 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>LINE</span>
                      </a>

                      <a
                        href={formatFacebookUrl(agent.facebook)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 flex items-center space-x-1 transition-colors"
                      >
                        <Facebook className="w-3.5 h-3.5 text-blue-600" />
                        <span>Facebook</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
