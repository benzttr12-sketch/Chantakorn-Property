'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Compass, 
  Home, 
  TrendingUp, 
  Trees, 
  Coins, 
  MapPin, 
  Check, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  Building,
  CheckCircle2
} from 'lucide-react';

interface QuizAnswers {
  goal: string;
  zone: string;
  budget: string;
}

export default function SmartPropertyMatchmaker() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>({
    goal: '',
    zone: '',
    budget: '',
  });

  const goals = [
    {
      id: 'house',
      title: 'อยู่อาศัยเองกับครอบครัว',
      subtitle: 'บ้านเดี่ยว ทาวน์โฮม คอนโดน่าอยู่',
      icon: Home,
      tag: 'ยอดนิยมสำหรับครอบครัว',
    },
    {
      id: 'investment',
      title: 'ลงทุนปล่อยเช่า / เกร็งกำไร',
      subtitle: 'คอนโดใกล้มหาวิทยาลัย ตึกแถวค้าขาย',
      icon: TrendingUp,
      tag: 'ผลตอบแทนสูง',
    },
    {
      id: 'land',
      title: 'ซื้อที่ดินสร้างบ้าน / จัดสรร',
      subtitle: 'ที่ดินเปล่าถมแล้ว ทำเลศักยภาพ',
      icon: Trees,
      tag: 'มูลค่าเพิ่มต่อเนื่อง',
    },
    {
      id: 'consignment',
      title: 'ขายฝาก / เปลี่ยนทรัพย์เป็นทุน',
      subtitle: 'ต้องการเสริมสภาพคล่องธุรกิจ ดอกเบี้ยถูกกฎหมาย',
      icon: Coins,
      tag: 'อนุมัติไวใน 48 ชม.',
    },
  ];

  const zones = [
    { id: 'ม.อ.', name: 'โซน ม.อ. – คอหงส์ – ปุณณกัณฑ์', desc: 'ใกล้มหาวิทยาลัยสงขลานครินทร์ รพ.สงขลานครินทร์' },
    { id: 'หาดใหญ่', name: 'โซนในเมือง – เซ็นทรัล – คลองเรียน', desc: 'ศูนย์กลางธุรกิจ เดินทางสะดวก ใกล้ห้างดัง' },
    { id: 'สนามบิน', name: 'โซนสนามบิน – คลองหอยโข่ง – หาดใหญ่ใน', desc: 'เงียบสงบ ใกล้สนามบินนานาชาติหาดใหญ่' },
    { id: 'คลองแห', name: 'โซนคลองแห – ลพบุรีราเมศวร์ – บิ๊กซี', desc: 'ย่านที่อยู่อาศัยใหม่ ใกล้ตลาดน้ำคลองแห' },
    { id: 'เมืองสงขลา', name: 'โซนเมืองสงขลา – เก้าเส้ง – ชลาทัศน์', desc: 'เมืองเก่า บรรยากาศริมทะเลสาบและชายหาด' },
    { id: 'all', name: 'ได้ทุกทำเลในหาดใหญ่–สงขลา', desc: 'เปิดรับทุกทำเลตามความคุ้มค่า' },
  ];

  const budgets = [
    { id: 'under2m', label: 'ต่ำกว่า 2 ล้านบาท', desc: 'เหมาะสำหรับเริ่มต้น คอนโด ทาวน์โฮมกะทัดรัด' },
    { id: '2m-4m', label: '2.0 – 4.0 ล้านบาท', desc: 'ช่วงราคายอดนิยม บ้านเดี่ยว ทาวน์โฮม 2 ชั้น' },
    { id: '4m-8m', label: '4.0 – 8.0 ล้านบาท', desc: 'บ้านเดี่ยวแปลงใหญ่ อาคารพาณิชย์ทำเลทอง' },
    { id: 'above8m', label: '8 ล้านบาทขึ้นไป', desc: 'พูลวิลล่า คฤหาสน์หรู หรือที่ดินแปลงใหญ่' },
  ];

  const handleSelectGoal = (id: string) => {
    setAnswers({ ...answers, goal: id });
    setStep(2);
  };

  const handleSelectZone = (id: string) => {
    setAnswers({ ...answers, zone: id });
    setStep(3);
  };

  const handleSelectBudget = (id: string) => {
    setAnswers({ ...answers, budget: id });
    setStep(4);
  };

  const handleFinish = () => {
    const params = new URLSearchParams();
    if (answers.goal && answers.goal !== 'consignment') {
      params.set('type', answers.goal);
    }
    if (answers.zone && answers.zone !== 'all') {
      params.set('district', answers.zone);
    }
    if (answers.budget === 'under2m') {
      params.set('maxPrice', '2000000');
    } else if (answers.budget === '2m-4m') {
      params.set('minPrice', '2000000');
      params.set('maxPrice', '4000000');
    } else if (answers.budget === '4m-8m') {
      params.set('minPrice', '4000000');
      params.set('maxPrice', '8000000');
    } else if (answers.budget === 'above8m') {
      params.set('minPrice', '8000000');
    }

    if (answers.goal === 'consignment') {
      router.push('/services');
    } else {
      router.push(`/properties?${params.toString()}`);
    }
  };

  const handleReset = () => {
    setStep(1);
    setAnswers({ goal: '', zone: '', budget: '' });
  };

  return (
    <div className="bg-gradient-to-br from-navy-950 via-[#0B192C] to-navy-950 rounded-3xl p-6 sm:p-10 lg:p-12 text-white border border-gold-500/20 shadow-2xl relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-navy-800/30 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-white/10 gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gold-400/20 text-gold-300 text-xs font-bold border border-gold-400/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span>ระบบแนะนำอัจฉริยะ (Property Matchmaker)</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ค้นหาอสังหาฯ ที่ตรงใจคุณใน 3 คลิก
          </h3>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            ตอบคำถามสั้นๆ เพื่อให้ระบบจับคู่อสังหาริมทรัพย์และทำเลที่คุ้มค่าที่สุดสำหรับคุณ
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center space-x-2">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                step === num
                  ? 'bg-gold-400 text-navy-950 ring-4 ring-gold-400/20'
                  : step > num
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {step > num ? <Check className="w-4 h-4 stroke-[3]" /> : num}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: GOAL */}
      {step === 1 && (
        <div className="relative z-10 animate-fadeIn">
          <div className="mb-4">
            <span className="text-xs text-gold-400 font-bold uppercase tracking-wider">คำถามที่ 1/3</span>
            <h4 className="text-lg sm:text-xl font-bold text-white mt-1">
              จุดประสงค์หลักในการค้นหาอสังหาฯ ของคุณคืออะไร?
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {goals.map((g) => {
              const Icon = g.icon;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSelectGoal(g.id)}
                  className="text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-400/60 rounded-2xl p-5 transition-all transform hover:-translate-y-1 group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gold-400/10 border border-gold-400/30 flex items-center justify-center text-gold-400 group-hover:bg-gold-400 group-hover:text-navy-950 transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gold-400/20 text-gold-300 border border-gold-400/30">
                      {g.tag}
                    </span>
                  </div>
                  <div className="font-bold text-base text-white group-hover:text-gold-300 transition-colors">
                    {g.title}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {g.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: ZONE */}
      {step === 2 && (
        <div className="relative z-10 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs text-gold-400 font-bold uppercase tracking-wider">คำถามที่ 2/3</span>
              <h4 className="text-lg sm:text-xl font-bold text-white mt-1">
                คุณกำลังมองหาทำเลไหนในหาดใหญ่–สงขลา?
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              ย้อนกลับ
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => handleSelectZone(z.id)}
                className="text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-400/60 rounded-2xl p-4 transition-all transform hover:-translate-y-1 group cursor-pointer"
              >
                <div className="flex items-center space-x-2 text-gold-400 text-xs font-bold mb-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>ทำเลยอดฮิต</span>
                </div>
                <div className="font-bold text-sm text-white group-hover:text-gold-300 transition-colors">
                  {z.name}
                </div>
                <div className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                  {z.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: BUDGET */}
      {step === 3 && (
        <div className="relative z-10 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs text-gold-400 font-bold uppercase tracking-wider">คำถามที่ 3/3</span>
              <h4 className="text-lg sm:text-xl font-bold text-white mt-1">
                งบประมาณที่เหมาะสมสำหรับคุณ?
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              ย้อนกลับ
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {budgets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectBudget(b.id)}
                className="text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-400/60 rounded-2xl p-5 transition-all transform hover:-translate-y-1 group cursor-pointer"
              >
                <div className="text-xl font-black text-white font-mono group-hover:text-gold-300 transition-colors">
                  {b.label}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {b.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: RESULT MATCHED SUMMARY */}
      {step === 4 && (
        <div className="relative z-10 animate-fadeIn bg-white/10 rounded-2xl p-6 border border-gold-400/40 backdrop-blur-md">
          <div className="flex items-center space-x-2 text-gold-400 text-xs font-bold mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>จับคู่คุณลักษณะอสังหาริมทรัพย์เรียบร้อยแล้ว</span>
          </div>

          <h4 className="text-2xl font-black text-white mb-4">
            พบอสังหาริมทรัพย์ที่ตรงกับความต้องการของคุณ!
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-xs">
            <div className="bg-navy-950/70 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block mb-0.5">ประเภท / วัตถุประสงค์</span>
              <span className="font-bold text-white">
                {goals.find((g) => g.id === answers.goal)?.title || 'ทุกประเภท'}
              </span>
            </div>
            <div className="bg-navy-950/70 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block mb-0.5">ทำเลเป้าหมาย</span>
              <span className="font-bold text-white">
                {zones.find((z) => z.id === answers.zone)?.name || 'หาดใหญ่-สงขลา'}
              </span>
            </div>
            <div className="bg-navy-950/70 p-3 rounded-xl border border-white/10">
              <span className="text-slate-400 block mb-0.5">งบประมาณ</span>
              <span className="font-bold text-gold-300 font-mono">
                {budgets.find((b) => b.id === answers.budget)?.label || 'ทุกช่วงราคา'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleFinish}
              className="px-8 py-3.5 bg-gradient-to-r from-gold-400 to-amber-500 hover:from-gold-300 hover:to-gold-400 text-navy-950 font-black text-sm rounded-xl shadow-lg flex items-center space-x-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>ดูรายการทรัพย์ที่ตรงกับผลลัพธ์</span>
              <ArrowRight className="w-4 h-4 text-navy-950 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ทำแบบทดสอบใหม่</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
