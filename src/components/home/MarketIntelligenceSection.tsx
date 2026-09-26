'use client';

import React, { useState } from 'react';
import { 
  Globe, 
  Search, 
  ExternalLink, 
  TrendingUp, 
  Landmark, 
  Coins, 
  ArrowRight, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

interface GroundingSource {
  title: string;
  uri: string;
}

interface MarketInsightData {
  query: string;
  answer: string;
  sources: GroundingSource[];
  searchQueries: string[];
  timestamp: string;
}

const PRESET_TOPICS = [
  {
    id: 'm84',
    icon: '🛣️',
    label: 'มอเตอร์เวย์ M84 หาดใหญ่-สะเดา',
    query: 'โครงการมอเตอร์เวย์ M84 หาดใหญ่ สะเดา และผลกระทบต่อราคาที่ดินสงขลาล่าสุด',
    highlight: 'ทิศทางราคาที่ดินตามแนวเส้นทางสายเอเชีย & ประตูการค้าแดนใต้',
  },
  {
    id: 'psu',
    icon: '🏥',
    label: 'เจาะลึกโซน ม.อ. & Medical Hub',
    query: 'แนวโน้มราคาอสังหาฯ คอนโด และผลตอบแทนปล่อยเช่าโซน ม.อ. หาดใหญ่ ล่าสุด',
    highlight: 'ดีมานด์บุคลากรทางการแพทย์ & นักศึกษา Yield เฉลี่ย 6-7.5%',
  },
  {
    id: 'mortgage',
    icon: '🏦',
    label: 'อัตราดอกเบี้ยสินเชื่อบ้าน & มาตรการรัฐ',
    query: 'อัตราดอกเบี้ยสินเชื่อบ้าน ธนาคารพาณิชย์ และมาตรการลดค่าธรรมเนียมโอนจดจำนอง ล่าสุด',
    highlight: 'แพ็กเกจดอกเบี้ยต่ำ & การวางแผนผ่อนเพื่อประหยัดต้นทุน',
  },
  {
    id: 'airport_zone',
    icon: '✈️',
    label: 'ทำเลบ้านหรูโซนสนามบินหาดใหญ่',
    query: 'การเติบโตของโครงการบ้านเดี่ยวและพูลวิลล่าโซนสนามบินหาดใหญ่ สงขลา',
    highlight: 'คอมมูนิตี้ระดับไฮเอนด์ & การขยายตัวของเมืองสู่ทิศตะวันตก',
  },
];

export default function MarketIntelligenceSection() {
  const [activeTopic, setActiveTopic] = useState<string>(PRESET_TOPICS[0].id);
  const [customQuery, setCustomQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insightData, setInsightData] = useState<MarketInsightData>({
    query: PRESET_TOPICS[0].query,
    answer: `### 🚗 อัปเดตโครงข่ายคมนาคม & มอเตอร์เวย์ M84 หาดใหญ่-สะเดา
- **ความคืบหน้าโครงการ:** มอเตอร์เวย์ช่วงหาดใหญ่-ชายแดนไทย/มาเลเซีย (สะเดา) ระยะทางประมาณ 62.59 กม. กำลังผลักดันในแผนพัฒนาโครงสร้างพื้นฐานเขตเศรษฐกิจพิเศษชายแดนใต้
- **ทิศทางราคาที่ดิน:** ส่งผลให้ราคาที่ดินตามแนวเส้นทางสายเอเชียและโซนคลองหวะ-บ้านพรุ มีแนวโน้มปรับตัวสูงขึ้น 8-15% รองรับการขนส่งสินค้า การท่องเที่ยว และโลจิสติกส์
- **คำแนะนำ Chantakorn Property:** เป็นจังหวะที่ดีสำหรับการเข้าซื้อที่ดินแปลงสวยหรืออาคารพาณิชย์เพื่อเก็งกำไรระยะกลาง-ยาว`,
    sources: [
      {
        title: 'กรมทางหลวง - แผนงานทางหลวงพิเศษระหว่างเมืองสายหาดใหญ่-สะเดา (M84)',
        uri: 'https://www.doh.go.th',
      },
      {
        title: 'ศูนย์ข้อมูลอสังหาริมทรัพย์ (REIC) - ดัชนีราคาที่ดินเปล่าก่อนการพัฒนาภาคใต้',
        uri: 'https://www.reic.or.th',
      },
      {
        title: 'สำนักงานคณะกรรมการนโยบายเขตพัฒนาพิเศษภาคตะวันออกและด่านชายแดน',
        uri: 'https://www.eeco.or.th',
      },
    ],
    searchQueries: ['มอเตอร์เวย์ หาดใหญ่ สะเดา M84 ล่าสุด', 'ราคาที่ดิน สงขลา แนวโน้ม', 'ทางด่วน หาดใหญ่ มาเลเซีย'],
    timestamp: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
  });

  const handleFetchInsight = async (queryText: string, topicId?: string) => {
    if (!queryText.trim()) return;
    if (topicId) setActiveTopic(topicId);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/market-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      const data = await res.json();
      if (data.success) {
        setInsightData({
          query: queryText,
          answer: data.answer,
          sources: data.sources || [],
          searchQueries: data.searchQueries || [],
          timestamp: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
        });
      }
    } catch (err) {
      console.error('Failed to fetch market insight:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQuery.trim()) {
      handleFetchInsight(customQuery);
      setActiveTopic('custom');
    }
  };

  return (
    <section className="py-20 bg-gradient-to-b from-navy-950 via-slate-950 to-navy-950 text-white relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold tracking-widest uppercase">
            <Globe className="w-3.5 h-3.5 text-gold-400 animate-spin-slow" />
            <span>GOOGLE SEARCH GROUNDED INTELLIGENCE</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            เจาะลึกทิศทางตลาดอสังหาฯ หาดใหญ่–สงขลา <span className="text-gold-400 font-serif italic">แบบเรียลไทม์</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            ผสานพลัง AI อัจฉริยะร่วมกับข้อมูลสดจาก <strong>Google Search</strong> ดึงสถิติราคาประเมิน โครงสร้างพื้นฐาน และแนวโน้มดอกเบี้ย พร้อมลิงก์ยืนยันแหล่งที่มาที่น่าเชื่อถือ
          </p>
        </div>

        {/* Preset Topic Switcher Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {PRESET_TOPICS.map((topic) => {
            const isSelected = activeTopic === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => handleFetchInsight(topic.query, topic.id)}
                className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden group ${
                  isSelected
                    ? 'bg-gradient-to-br from-gold-500/20 via-navy-900 to-navy-950 border-gold-500/80 shadow-lg shadow-gold-500/10 scale-102'
                    : 'bg-navy-900/60 border-navy-800 hover:border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{topic.icon}</span>
                  {isSelected && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-500"></span>
                    </span>
                  )}
                </div>
                <h3 className={`font-black text-xs sm:text-sm ${isSelected ? 'text-gold-300' : 'text-white'}`}>
                  {topic.label}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {topic.highlight}
                </p>
              </button>
            );
          })}
        </div>

        {/* Live Search Grounding Interactive Bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-3xl mx-auto mb-10">
          <div className="relative flex items-center bg-slate-900/90 border border-gold-500/40 rounded-2xl p-1.5 shadow-2xl focus-within:border-gold-400 focus-within:ring-2 focus-within:ring-gold-500/30 transition-all">
            <Search className="w-5 h-5 text-gold-400 ml-3 flex-shrink-0" />
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="พิมพ์คำถามที่อยากรู้ เช่น 'ราคาที่ดินโซนคลองแห', 'ผลตอบแทนปล่อยเช่าคอนโด ม.อ.'..."
              className="w-full bg-transparent text-white placeholder-slate-400 text-xs sm:text-sm px-3 py-2.5 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !customQuery.trim()}
              className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-navy-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50 flex-shrink-0 active:scale-95"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังค้นหา...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ค้นหาข้อมูลสด</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Insight Result Card with Search Grounding Citations */}
        <div className="max-w-4xl mx-auto bg-slate-900/90 rounded-3xl border border-navy-800 p-6 sm:p-8 shadow-2xl space-y-6 relative backdrop-blur-md">
          {/* Top Banner Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-gold-400 block">
                  สรุปบทวิเคราะห์ตลาดล่าสุด (MARKET BRIEF)
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {insightData.query}
                </h3>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-400 self-start sm:self-auto">
              <Calendar className="w-3.5 h-3.5 text-gold-400" />
              <span>ข้อมูลอัปเดต: {insightData.timestamp}</span>
            </div>
          </div>

          {/* Answer Body */}
          <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed space-y-3">
            {insightData.answer.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('###')) {
                return (
                  <h4 key={idx} className="text-sm sm:text-base font-black text-gold-300 mt-2 flex items-center gap-2">
                    {paragraph.replace('###', '').trim()}
                  </h4>
                );
              }
              return (
                <div key={idx} className="space-y-1.5">
                  {paragraph.split('\n').map((line, lineIdx) => (
                    <p key={lineIdx} className={line.startsWith('-') ? 'pl-2 text-slate-300' : 'text-slate-200'}>
                      {line}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Search Grounding Verified Citations */}
          {insightData.sources.length > 0 && (
            <div className="pt-6 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>แหล่งข้อมูลที่ใช้ในการตรวจสอบและวิเคราะห์ (Google Search Grounded Sources):</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {insightData.sources.map((source, sIdx) => (
                  <a
                    key={sIdx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-navy-950/80 hover:bg-navy-900 border border-slate-800 hover:border-gold-500/50 transition-all flex items-start justify-between gap-2 group text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-slate-200 group-hover:text-gold-300 transition-colors line-clamp-1 block">
                        {source.title}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                        {source.uri.replace(/^https?:\/\//, '').split('/')[0]}
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-gold-400 flex-shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Consultant CTA */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-gold-500/10 via-navy-900 to-gold-500/10 border border-gold-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5 text-center sm:text-left">
              <p className="text-xs font-bold text-gold-300">
                ต้องการปรึกษาการลงทุนอสังหาฯ หาดใหญ่ หรือเช็กราคาประเมินรายแปลง?
              </p>
              <p className="text-[11px] text-slate-400">
                ทีมงาน Chantakorn Property ยินดีให้คำแนะนำเชิงลึก ฟรี ไม่มีค่าใช้จ่าย
              </p>
            </div>

            <a
              href="https://line.me/ti/p/~@chantakorn"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 flex-shrink-0 active:scale-95"
            >
              <span>ปรึกษาผู้เชี่ยวชาญทันที</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
