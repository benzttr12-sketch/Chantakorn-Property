'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Calculator, 
  Coins, 
  Wallet, 
  Building2, 
  Percent, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  PhoneCall, 
  HelpCircle,
  Sparkles,
  Search,
  ShieldCheck,
  FileText,
  Clock,
  Landmark,
  Scale,
  Send,
  AlertCircle
} from 'lucide-react';
import { formatThaiNumber } from '@/lib/utils';

interface ConsignmentCalculatorProps {
  initialPrice?: number;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export default function MortgageCalculator({
  initialPrice = 3000000,
  compact = false,
  title = 'เครื่องคำนวณขายฝาก-จำนอง & ดอกเบี้ยรับเงินด่วน',
  subtitle = 'ประมาณการวงเงินรับขายฝาก ดอกเบี้ยรายเดือน และค่าธรรมเนียม ณ กรมที่ดิน ถูกต้องตามกฎหมาย 100%'
}: ConsignmentCalculatorProps) {
  const [activeTab, setActiveTab] = useState<'consignment' | 'land_fees' | 'benefits'>('consignment');

  // Tab 1: Consignment calculation
  const [propertyValue, setPropertyValue] = useState<number>(initialPrice);
  const [ltvPercent, setLtvPercent] = useState<number>(60); // 40% - 70% of appraisal value
  const [interestRatePerYear, setInterestRatePerYear] = useState<number>(12); // 9% - 15% (Legal max 15% / yr = 1.25% / mo)
  const [contractYears, setContractYears] = useState<number>(1); // 1, 2, 3 years

  // Tab 2: Land Office Fees calculation
  const [holdingYears, setHoldingYears] = useState<'less_than_5' | 'more_than_5'>('more_than_5');
  const [customAppraisalValue, setCustomAppraisalValue] = useState<number>(initialPrice);

  // Quick inquiry form modal / inline state
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  // Calculations for Tab 1: Consignment Amount & Interest
  const consignmentAmount = useMemo(() => {
    return Math.round((propertyValue * ltvPercent) / 100);
  }, [propertyValue, ltvPercent]);

  const monthlyInterestRate = useMemo(() => {
    return interestRatePerYear / 12;
  }, [interestRatePerYear]);

  const monthlyInterestPayment = useMemo(() => {
    return Math.round((consignmentAmount * (interestRatePerYear / 100)) / 12);
  }, [consignmentAmount, interestRatePerYear]);

  const totalContractMonths = useMemo(() => {
    return contractYears * 12;
  }, [contractYears]);

  const totalInterestPayment = useMemo(() => {
    return monthlyInterestPayment * totalContractMonths;
  }, [monthlyInterestPayment, totalContractMonths]);

  const totalRedemptionAmount = useMemo(() => {
    return consignmentAmount + totalInterestPayment;
  }, [consignmentAmount, totalInterestPayment]);

  // Land Office Estimated Fees (Tab 2)
  // 1. Fee: 2% of Appraisal Value
  const landRegistrationFee = useMemo(() => {
    return Math.round(customAppraisalValue * 0.02);
  }, [customAppraisalValue]);

  // 2. Withholding Tax: Approx 1.5% - 2% (Estimated average)
  const withholdingTaxFee = useMemo(() => {
    return Math.round(customAppraisalValue * 0.015);
  }, [customAppraisalValue]);

  // 3. Stamp Duty (0.5%) or Specific Business Tax (3.3%)
  const stampOrBizTaxFee = useMemo(() => {
    if (holdingYears === 'less_than_5') {
      return Math.round(customAppraisalValue * 0.033); // SBT 3.3%
    }
    return Math.round(customAppraisalValue * 0.005); // Stamp Duty 0.5%
  }, [customAppraisalValue, holdingYears]);

  const otherLandFees = 150; // Administrative fee, stamps, witness fee

  const totalLandFees = useMemo(() => {
    return landRegistrationFee + withholdingTaxFee + stampOrBizTaxFee + otherLandFees;
  }, [landRegistrationFee, withholdingTaxFee, stampOrBizTaxFee]);

  // Estimated Net Cash Received
  const estimatedNetReceived = useMemo(() => {
    return Math.max(0, consignmentAmount - totalLandFees);
  }, [consignmentAmount, totalLandFees]);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryPhone.trim()) return;
    setInquirySubmitted(true);
  };

  return (
    <div className={`bg-white rounded-3xl border border-surface-border shadow-card overflow-hidden ${compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8 lg:p-10'}`}>
      {/* Header */}
      {!compact && (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gold-50 text-gold-800 text-xs font-bold mb-3 border border-gold-200">
            <Scale className="w-3.5 h-3.5 text-gold-600" />
            <span>Chantakorn Consignment & Finance</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-navy-950 tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
            {subtitle}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-center p-1.5 bg-gray-100/90 rounded-2xl max-w-xl mx-auto mb-8">
        <button
          type="button"
          onClick={() => setActiveTab('consignment')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'consignment'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-black/5'
              : 'text-gray-600 hover:text-navy-950 hover:bg-white/60'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>คำนวณวงเงิน & ดอกเบี้ย</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('land_fees')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'land_fees'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-black/5'
              : 'text-gray-600 hover:text-navy-950 hover:bg-white/60'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>ค่าธรรมเนียมกรมที่ดิน</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('benefits')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'benefits'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-black/5'
              : 'text-gray-600 hover:text-navy-950 hover:bg-white/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>เงื่อนไข & จุดเด่น</span>
        </button>
      </div>

      {/* TAB 1: CONSIGNMENT & INTEREST CALCULATOR */}
      {activeTab === 'consignment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Control 1: Property Appraisal Value */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-gold-600" />
                  <span>มูลค่าประเมิน / ราคาตลาดของทรัพย์สิน</span>
                  <span className="text-gray-400 text-xs font-normal">(บาท)</span>
                </label>
                <div className="flex items-center space-x-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-gold-500 focus-within:bg-white transition-all">
                  <span className="text-xs font-bold text-gray-500">฿</span>
                  <input
                    type="number"
                    min={10000}
                    max={50000000}
                    step={10000}
                    value={propertyValue || ''}
                    onChange={(e) => setPropertyValue(Math.max(0, Number(e.target.value)))}
                    className="w-32 sm:w-36 text-sm sm:text-base font-black text-navy-950 font-mono bg-transparent outline-none text-right"
                    placeholder="50000"
                  />
                </div>
              </div>
              <input
                type="range"
                min={10000}
                max={20000000}
                step={10000}
                value={propertyValue}
                onChange={(e) => setPropertyValue(Number(e.target.value))}
                className="w-full h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>฿10,000 (หลักหมื่น)</span>
                <span>฿500,000</span>
                <span>฿1,000,000</span>
                <span>฿5,000,000</span>
                <span>฿20,000,000+</span>
              </div>
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[
                  { label: '5 หมื่น', val: 50000 },
                  { label: '1 แสน', val: 100000 },
                  { label: '3 แสน', val: 300000 },
                  { label: '5 แสน', val: 500000 },
                  { label: '1 ล้าน', val: 1000000 },
                  { label: '2 ล้าน', val: 2000000 },
                  { label: '3 ล้าน', val: 3000000 },
                  { label: '5 ล้าน', val: 5000000 },
                  { label: '10 ล้าน', val: 10000000 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setPropertyValue(item.val)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      propertyValue === item.val
                        ? 'bg-navy-950 text-gold-400 border-navy-950 font-bold'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Control 2: Desired LTV % (Consignment Percentage) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <span>สัดส่วนวงเงินรับขายฝาก (LTV)</span>
                  <span className="text-gold-700 font-bold text-xs">({ltvPercent}%)</span>
                </label>
                <div className="text-xs sm:text-sm font-bold text-navy-950 font-mono">
                  วงเงินที่ได้รับ: ฿{formatThaiNumber(consignmentAmount)}
                </div>
              </div>
              <input
                type="range"
                min={30}
                max={70}
                step={5}
                value={ltvPercent}
                onChange={(e) => setLtvPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>30% (ปลอดภัยสูง)</span>
                <span>50% (มาตรฐาน)</span>
                <span>60% (แนะนำ)</span>
                <span>70% (สูงสุด)</span>
              </div>
            </div>

            {/* Control 3: Interest Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <Percent className="w-3.5 h-3.5 text-gray-400" />
                  <span>อัตราดอกเบี้ยขายฝากตามกฎหมาย</span>
                </label>
                <div className="text-base sm:text-lg font-black text-navy-950 font-mono">
                  {interestRatePerYear.toFixed(1)}% <span className="text-xs font-normal text-gray-500">ต่อปี ({(monthlyInterestRate).toFixed(2)}%/เดือน)</span>
                </div>
              </div>
              <input
                type="range"
                min={9}
                max={15}
                step={0.5}
                value={interestRatePerYear}
                onChange={(e) => setInterestRatePerYear(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: '9% ต่อปี (0.75%/ด.) พิเศษ', val: 9 },
                  { label: '12% ต่อปี (1.00%/ด.) ยอดนิยม', val: 12 },
                  { label: '15% ต่อปี (1.25%/ด.) เพดานกฎหมาย', val: 15 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setInterestRatePerYear(item.val)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      interestRatePerYear === item.val
                        ? 'bg-navy-950 text-gold-400 border-navy-950 font-bold'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                * ตาม พ.ร.บ. คุ้มครองประชาชนในการทำสัญญาขายฝากที่ดินฯ อัตราดอกเบี้ยต้องไม่เกิน 15% ต่อปี
              </p>
            </div>

            {/* Control 4: Contract Term */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>ระยะเวลาสัญญาขายฝาก</span>
                </label>
                <div className="text-base sm:text-lg font-black text-navy-950 font-mono">
                  {contractYears} ปี <span className="text-xs font-normal text-gray-400">({totalContractMonths} เดือน)</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '6 เดือน', yrs: 0.5 },
                  { label: '1 ปี (แนะนำ)', yrs: 1 },
                  { label: '2 ปี', yrs: 2 },
                  { label: '3 ปี', yrs: 3 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setContractYears(item.yrs)}
                    className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition-all ${
                      contractYears === item.yrs
                        ? 'bg-navy-950 text-gold-400 border-navy-950 shadow-sm'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                * สัญญาขายฝากสามารถขยายต่ออายุได้สูงสุดถึง 10 ปี ตามที่ตกลงกัน
              </p>
            </div>
          </div>

          {/* Results Summary Card (5 Cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-navy-800 space-y-6">
            <div>
              <span className="text-[11px] font-bold text-gold-400 uppercase tracking-wider block mb-1">
                ดอกเบี้ยที่ต้องชำระต่อเดือน
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                  ฿{formatThaiNumber(monthlyInterestPayment)}
                </span>
                <span className="text-xs text-gray-400 font-medium">/ เดือน</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                คิดจากวงเงินรับขายฝาก ฿{formatThaiNumber(consignmentAmount)} (ดอกเบี้ย {monthlyInterestRate.toFixed(2)}%/ด.)
              </p>
            </div>

            {/* Net Received Estimation Card */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium flex items-center space-x-1.5">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <span>วงเงินขายฝากที่อนุมัติ (เงินต้น)</span>
                </span>
                <span className="font-bold text-emerald-300 font-mono text-base">
                  ฿{formatThaiNumber(consignmentAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>หักค่าธรรมเนียมกรมที่ดินประมาณการ:</span>
                <span className="font-mono text-rose-300">-฿{formatThaiNumber(totalLandFees)}</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-gold-300">รับเงินสุทธิในวันทำสัญญา:</span>
                <span className="text-base sm:text-lg font-black text-gold-400 font-mono">
                  ≈ ฿{formatThaiNumber(estimatedNetReceived)}
                </span>
              </div>
            </div>

            {/* Breakdown Summary */}
            <div className="space-y-2.5 pt-2 border-t border-white/10 text-xs">
              <div className="flex justify-between text-gray-300">
                <span>ระยะเวลาสัญญา:</span>
                <span className="font-mono font-bold text-white">{contractYears} ปี ({totalContractMonths} เดือน)</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>ดอกเบี้ยรวมตลอดสัญญา:</span>
                <span className="font-mono font-bold text-gold-300">฿{formatThaiNumber(totalInterestPayment)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>ยอดเงินไถ่ถอนคืนกรรมสิทธิ์ (สินไถ่):</span>
                <span className="font-mono font-bold text-white">฿{formatThaiNumber(consignmentAmount)}</span>
              </div>
              <p className="text-[10px] text-gray-400 italic">
                * ชำระดอกเบี้ยรายเดือน และชำระเงินต้นคืนในวันไถ่ถอนกรรมสิทธิ์
              </p>
            </div>

            {/* CTA action buttons */}
            <div className="pt-2 space-y-2">
              <a
                href="https://line.me/R/ti/p/@chantakorn"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-950 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-4 h-4 fill-navy-950" />
                <span>ส่งโฉนดประเมินวงเงินขายฝากด่วน (LINE)</span>
              </a>

              <a
                href="tel:0816040097"
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-white/10"
              >
                <PhoneCall className="w-3.5 h-3.5 text-gold-400" />
                <span>โทรสายด่วนคุณฉันทากร: 081-604-0097</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LAND OFFICE FEES CALCULATOR */}
      {activeTab === 'land_fees' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <label className="text-xs sm:text-sm font-bold text-navy-950 block mb-2">
                ราคาประเมินทุนทรัพย์ของกรมที่ดิน (บาท)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min={10000}
                  step={10000}
                  value={customAppraisalValue || ''}
                  onChange={(e) => setCustomAppraisalValue(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-navy-950 focus:bg-white focus:ring-2 focus:ring-navy-950 outline-none"
                  placeholder="50000"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[50000, 100000, 300000, 500000, 1000000, 3000000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCustomAppraisalValue(val)}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                      customAppraisalValue === val
                        ? 'bg-navy-950 text-gold-400 border-navy-950 font-bold'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {val >= 1000000 ? `${(val / 1000000).toFixed(1)} ล้าน` : `฿${formatThaiNumber(val)}`}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                * คำนวณค่าธรรมเนียมและภาษีจากราคาประเมินราชการ ณ สำนักงานที่ดิน (รองรับตั้งแต่หลักหมื่นเป็นต้นไป)
              </p>
            </div>

            {/* Holding Period */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-navy-950 block mb-2">
                ระยะเวลาการถือครองกรรมสิทธิ์ของผู้ขายฝาก
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHoldingYears('more_than_5')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    holdingYears === 'more_than_5'
                      ? 'bg-navy-950 text-white border-navy-950 shadow-sm ring-2 ring-gold-400/50'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  <div className="font-bold text-xs">ถือครองเกิน 5 ปี หรือ มีชื่อในทะเบียนบ้านเกิน 1 ปี</div>
                  <div className={`text-[11px] mt-1 ${holdingYears === 'more_than_5' ? 'text-gold-300' : 'text-gray-500'}`}>
                    เสียค่าอากรแสตมป์ 0.5% (ไม่ต้องเสียภาษีธุรกิจเฉพาะ)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setHoldingYears('less_than_5')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    holdingYears === 'less_than_5'
                      ? 'bg-navy-950 text-white border-navy-950 shadow-sm ring-2 ring-gold-400/50'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  <div className="font-bold text-xs">ถือครองไม่ถึง 5 ปี (ไม่มีชื่อในทะเบียนบ้านเกิน 1 ปี)</div>
                  <div className={`text-[11px] mt-1 ${holdingYears === 'less_than_5' ? 'text-gold-300' : 'text-gray-500'}`}>
                    เสียภาษีธุรกิจเฉพาะ 3.3%
                  </div>
                </button>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-200 space-y-3">
              <h4 className="text-xs font-bold text-navy-950 flex items-center space-x-1.5 pb-2 border-b border-gray-200">
                <FileText className="w-4 h-4 text-gold-600" />
                <span>แจกแจงรายการค่าธรรมเนียมและภาษี ณ กรมที่ดิน</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-700">
                  <span>1. ค่าธรรมเนียมจดทะเบียนขายฝาก (2%):</span>
                  <span className="font-mono font-bold text-navy-950">฿{formatThaiNumber(landRegistrationFee)}</span>
                </div>

                <div className="flex justify-between items-center text-gray-700">
                  <span>2. ภาษีเงินได้หัก ณ ที่จ่าย (ประมาณการ ~1.5%):</span>
                  <span className="font-mono font-bold text-navy-950">฿{formatThaiNumber(withholdingTaxFee)}</span>
                </div>

                <div className="flex justify-between items-center text-gray-700">
                  <span>
                    3. {holdingYears === 'less_than_5' ? 'ภาษีธุรกิจเฉพาะ (3.3%)' : 'ค่าอากรแสตมป์ (0.5%)'}:
                  </span>
                  <span className="font-mono font-bold text-navy-950">฿{formatThaiNumber(stampOrBizTaxFee)}</span>
                </div>

                <div className="flex justify-between items-center text-gray-700">
                  <span>4. ค่าคำขอ พยาน และค่าธรรมเนียมอื่นๆ:</span>
                  <span className="font-mono font-bold text-navy-950">฿{formatThaiNumber(otherLandFees)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-navy-950 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-navy-800 space-y-6">
            <div>
              <span className="text-[11px] font-bold text-gold-400 uppercase tracking-wider block mb-1">
                ประมาณการค่าใช้จ่ายรวม ณ สำนักงานที่ดิน
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                ฿{formatThaiNumber(totalLandFees)}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                สำหรับราคาประเมินราชการ ฿{formatThaiNumber(customAppraisalValue)}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-gold-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-gold-400 flex-shrink-0" />
                <span>คำแนะนำจาก Chantakorn Property</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                การชำระค่าธรรมเนียมและภาษี ณ กรมที่ดินสามารถตกลงแบ่งจ่ายระหว่างผู้ขายฝากและผู้รับซื้อฝากได้ตามที่ระบุในสัญญา หรือหักจากยอดเงินก้อนที่ได้รับในวันจดทะเบียน
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <a
                href="https://line.me/R/ti/p/@chantakorn"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-950 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg transition-all"
              >
                <Sparkles className="w-4 h-4 fill-navy-950" />
                <span>เช็กค่าธรรมเนียมที่ดินอย่างละเอียดฟรี</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BENEFITS & HOW IT WORKS */}
      {activeTab === 'benefits' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-navy-950">
              ข้อดีของการขายฝาก-จำนอง กับ Chantakorn Property
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-gold-100 text-gold-800 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-navy-950">อนุมัติไว ได้เงินเร็ว 1-3 วัน</div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  ตรวจสอบโฉนดและประเมินทรัพย์อย่างรวดเร็ว ทำสัญญาและรับเงินสด/เช็คทันทีที่กรมที่ดิน
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-navy-950">ไม่เช็คบูโร / ภาระหนี้</div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  พิจารณาจากมูลค่าโฉนดและหลักทรัพย์เป็นหลัก ไม่ต้องใช้สลิปเงินเดือนหรือคนค้ำประกัน
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-navy-950">ยังอยู่อาศัยได้ตามปกติ</div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  ไม่ต้องย้ายออกจากบ้าน ยังคงพักอาศัยหรือดำเนินธุรกิจ เก็บค่าเช่าได้ตามปกติ
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-navy-950">ถูกกฎหมาย 100% ณ กรมที่ดิน</div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  จดทะเบียนนิติกรรมต่อหน้าเจ้าพนักงานที่ดิน ดอกเบี้ยตาม พ.ร.บ. คุ้มครองสัญญาขายฝากฯ
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5 text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>เอกสารที่ต้องใช้ในการพิจารณาเบื้องต้น</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5 pt-1">
                <li>สำเนาโฉนดที่ดินหน้า-หลัง ชัดเจนทุกมุม</li>
                <li>รูปถ่ายทรัพย์สินจริง ปัจจุบัน และแผนที่/พิกัด GPS</li>
                <li>สำเนาบัตรประชาชน และทะเบียนบ้านของเจ้าของกรรมสิทธิ์</li>
              </ul>
            </div>
          </div>

          {/* Inquiry Form (5 Cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-navy-800 space-y-5">
            <div>
              <span className="text-[11px] font-bold text-gold-400 uppercase tracking-wider block mb-1">
                ยื่นเรื่องประเมินขายฝากด่วน
              </span>
              <h4 className="text-lg sm:text-xl font-black text-white">
                ขอรับการประเมินวงเงินฟรี
              </h4>
              <p className="text-[11px] text-gray-400 mt-1">
                ทีมงานผู้เชี่ยวชาญจะติดต่อกลับเพื่อให้คำปรึกษาและประเมินวงเงินภายใน 2 ชั่วโมง
              </p>
            </div>

            {inquirySubmitted ? (
              <div className="p-5 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-sm font-bold text-white">ได้รับข้อมูลเรียบร้อยแล้ว</div>
                <p className="text-xs text-emerald-200">
                  เจ้าหน้าที่จะติดต่อกลับที่เบอร์ {inquiryPhone} เพื่อประเมินวงเงินให้โดยเร็วที่สุดครับ
                </p>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    ชื่อ-นามสกุล
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    placeholder="เช่น คุณสมชาย"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-gold-400 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    type="tel"
                    required
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-gold-400 focus:bg-white/15"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-950 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>ส่งข้อมูลขอประเมินวงเงิน</span>
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-white/10 text-center">
              <a
                href="https://line.me/R/ti/p/@chantakorn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gold-300 hover:text-gold-200 font-bold inline-flex items-center space-x-1"
              >
                <span>หรือแอด LINE ส่งรูปโฉนดทันที: @chantakorn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
