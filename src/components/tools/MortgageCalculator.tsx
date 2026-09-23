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
  RotateCcw
} from 'lucide-react';
import { formatThaiNumber } from '@/lib/utils';

interface MortgageCalculatorProps {
  initialPrice?: number;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export default function MortgageCalculator({
  initialPrice = 3500000,
  compact = false,
  title = 'เครื่องคำนวณสินเชื่อบ้าน & ยอดผ่อนชำระ',
  subtitle = 'วางแผนการเงินและประมาณการค่างวดผ่อนบ้านเบื้องต้น เพื่อเตรียมความพร้อมก่อนยื่นกู้จริงกับธนาคาร'
}: MortgageCalculatorProps) {
  const [activeTab, setActiveTab] = useState<'installment' | 'affordability'>('installment');

  // Tab 1: Installment calculation
  const [propertyPrice, setPropertyPrice] = useState<number>(initialPrice);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(10); // 10%
  const [interestRate, setInterestRate] = useState<number>(3.5); // 3.5%
  const [loanTermYears, setLoanTermYears] = useState<number>(30); // 30 years

  // Tab 2: Salary to Loan calculation
  const [monthlyIncome, setMonthlyIncome] = useState<number>(35000);
  const [existingDebt, setExistingDebt] = useState<number>(5000);
  const [affordInterestRate, setAffordInterestRate] = useState<number>(3.5);
  const [affordYears, setAffordYears] = useState<number>(30);

  // Calculations for Tab 1
  const downPaymentAmount = useMemo(() => {
    return Math.round((propertyPrice * downPaymentPercent) / 100);
  }, [propertyPrice, downPaymentPercent]);

  const loanAmount = useMemo(() => {
    return Math.max(0, propertyPrice - downPaymentAmount);
  }, [propertyPrice, downPaymentAmount]);

  const monthlyPayment = useMemo(() => {
    if (loanAmount <= 0) return 0;
    const monthlyRate = interestRate / 100 / 12;
    const totalMonths = loanTermYears * 12;

    if (monthlyRate === 0) {
      return Math.round(loanAmount / totalMonths);
    }

    const emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
      (Math.pow(1 + monthlyRate, totalMonths) - 1);

    return Math.round(emi);
  }, [loanAmount, interestRate, loanTermYears]);

  const totalPayment = useMemo(() => {
    return monthlyPayment * loanTermYears * 12;
  }, [monthlyPayment, loanTermYears]);

  const totalInterest = useMemo(() => {
    return Math.max(0, totalPayment - loanAmount);
  }, [totalPayment, loanAmount]);

  // Minimum required income (Assuming 40% DSR - Debt Service Ratio)
  const requiredIncome = useMemo(() => {
    return Math.round(monthlyPayment / 0.4);
  }, [monthlyPayment]);

  // Calculations for Tab 2: Affordability
  const maxAffordableMonthlyPayment = useMemo(() => {
    // 40% of income minus existing debts
    const maxInstallmentAllowance = monthlyIncome * 0.4;
    return Math.max(0, Math.round(maxInstallmentAllowance - existingDebt));
  }, [monthlyIncome, existingDebt]);

  const maxLoanAmount = useMemo(() => {
    if (maxAffordableMonthlyPayment <= 0) return 0;
    const monthlyRate = affordInterestRate / 100 / 12;
    const totalMonths = affordYears * 12;

    if (monthlyRate === 0) {
      return maxAffordableMonthlyPayment * totalMonths;
    }

    // PV formula
    const pv = (maxAffordableMonthlyPayment * (Math.pow(1 + monthlyRate, totalMonths) - 1)) /
      (monthlyRate * Math.pow(1 + monthlyRate, totalMonths));

    return Math.round(pv / 10000) * 10000; // Round to nearest 10,000
  }, [maxAffordableMonthlyPayment, affordInterestRate, affordYears]);

  const estimatedPropertyBudget = useMemo(() => {
    // Assuming 90% loan-to-value (10% down payment)
    return Math.round(maxLoanAmount / 0.9 / 10000) * 10000;
  }, [maxLoanAmount]);

  return (
    <div className={`bg-white rounded-3xl border border-surface-border shadow-card overflow-hidden ${compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8 lg:p-10'}`}>
      {/* Header */}
      {!compact && (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gold-50 text-gold-800 text-xs font-bold mb-3 border border-gold-200">
            <Calculator className="w-3.5 h-3.5 text-gold-600" />
            <span>Chantakorn Financial Tools</span>
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
      <div className="flex items-center justify-center p-1.5 bg-gray-100/90 rounded-2xl max-w-md mx-auto mb-8">
        <button
          type="button"
          onClick={() => setActiveTab('installment')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'installment'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-black/5'
              : 'text-gray-600 hover:text-navy-950 hover:bg-white/60'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>คำนวณค่างวดผ่อน</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('affordability')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'affordability'
              ? 'bg-navy-950 text-gold-400 shadow-md ring-1 ring-black/5'
              : 'text-gray-600 hover:text-navy-950 hover:bg-white/60'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>ประเมินจากเงินเดือน</span>
        </button>
      </div>

      {/* TAB 1: INSTALLMENT CALCULATOR */}
      {activeTab === 'installment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Control 1: Property Price */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <span>ราคาอสังหาริมทรัพย์</span>
                  <span className="text-gray-400 text-xs font-normal">(บาท)</span>
                </label>
                <div className="text-base sm:text-lg font-black text-navy-950 font-mono">
                  ฿{formatThaiNumber(propertyPrice)}
                </div>
              </div>
              <input
                type="range"
                min={500000}
                max={30000000}
                step={100000}
                value={propertyPrice}
                onChange={(e) => setPropertyPrice(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[1500000, 2500000, 3500000, 5000000, 8000000, 12000000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPropertyPrice(val)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      propertyPrice === val
                        ? 'bg-navy-950 text-gold-400 border-navy-950 font-bold'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {val >= 1000000 ? `${(val / 1000000).toFixed(1)} ล้าน` : `${formatThaiNumber(val)}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Control 2: Down Payment */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <span>เงินดาวน์</span>
                  <span className="text-gold-700 font-bold text-xs">({downPaymentPercent}%)</span>
                </label>
                <div className="text-xs sm:text-sm font-bold text-gray-700 font-mono">
                  ฿{formatThaiNumber(downPaymentAmount)} (ยอดกู้ ฿{formatThaiNumber(loanAmount)})
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={downPaymentPercent}
                onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0% (กู้ 100%)</span>
                <span>10%</span>
                <span>20%</span>
                <span>30%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Control 3: Loan Term Years */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>ระยะเวลากู้</span>
                </label>
                <div className="text-base sm:text-lg font-black text-navy-950 font-mono">
                  {loanTermYears} ปี <span className="text-xs font-normal text-gray-400">({loanTermYears * 12} งวด)</span>
                </div>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                step={5}
                value={loanTermYears}
                onChange={(e) => setLoanTermYears(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>10 ปี</span>
                <span>20 ปี</span>
                <span>30 ปี (นิยมสุด)</span>
                <span>40 ปี</span>
              </div>
            </div>

            {/* Control 4: Interest Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <Percent className="w-3.5 h-3.5 text-gray-400" />
                  <span>อัตราดอกเบี้ยเฉลี่ย</span>
                  <span className="text-gray-400 text-xs font-normal">(% ต่อปี)</span>
                </label>
                <div className="text-base sm:text-lg font-black text-navy-950 font-mono">
                  {interestRate.toFixed(2)}%
                </div>
              </div>
              <input
                type="range"
                min={1.5}
                max={8.5}
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              {/* Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: 'ธอส. 3.0%', val: 3.0 },
                  { label: 'ทั่วไป 3.5%', val: 3.5 },
                  { label: 'เฉลี่ย 4.25%', val: 4.25 },
                  { label: 'MRR- 5.5%', val: 5.5 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setInterestRate(item.val)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      interestRate === item.val
                        ? 'bg-navy-950 text-gold-400 border-navy-950 font-bold'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Summary Card (5 Cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-navy-800 space-y-6">
            <div>
              <span className="text-[11px] font-bold text-gold-400 uppercase tracking-wider block mb-1">
                ประมาณการค่างวดผ่อนต่อเดือน
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                  ฿{formatThaiNumber(monthlyPayment)}
                </span>
                <span className="text-xs text-gray-400 font-medium">/ เดือน</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                ผ่อน {loanTermYears} ปี ดอกเบี้ย {interestRate}% ยอดกู้ ฿{formatThaiNumber(loanAmount)}
              </p>
            </div>

            {/* Income Recommendation */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-medium flex items-center space-x-1.5">
                  <Wallet className="w-4 h-4 text-gold-400" />
                  <span>รายได้ขั้นต่ำที่แนะนำ (กู้เดี่ยวหรือร่วม)</span>
                </span>
                <span className="font-bold text-gold-300 font-mono text-sm">
                  ฿{formatThaiNumber(requiredIncome)}+
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                * คำนวณจากภาระหนี้ไม่เกิน 40% ของรายได้ตามเกณฑ์ธนาคารพาณิชย์
              </p>
            </div>

            {/* Breakdown Bars */}
            <div className="space-y-2.5 pt-2 border-t border-white/10 text-xs">
              <div className="flex justify-between text-gray-300">
                <span>เงินต้นรวม:</span>
                <span className="font-mono font-bold text-white">฿{formatThaiNumber(loanAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>ดอกเบี้ยรวมตลอดสัญญา:</span>
                <span className="font-mono font-bold text-gold-300">฿{formatThaiNumber(totalInterest)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>ยอดชำระรวมทั้งหมด:</span>
                <span className="font-mono font-bold text-white">฿{formatThaiNumber(totalPayment)}</span>
              </div>

              {/* Progress bar visually showing Principal vs Interest */}
              {totalPayment > 0 && (
                <div className="pt-2">
                  <div className="w-full h-3 bg-navy-800 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className="bg-gold-500 h-full transition-all duration-300"
                      style={{ width: `${Math.round((loanAmount / totalPayment) * 100)}%` }}
                      title="เงินต้น"
                    />
                    <div
                      className="bg-amber-700/80 h-full transition-all duration-300"
                      style={{ width: `${Math.round((totalInterest / totalPayment) * 100)}%` }}
                      title="ดอกเบี้ย"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-gold-500" />
                      <span>เงินต้น {Math.round((loanAmount / totalPayment) * 100)}%</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-amber-700/80" />
                      <span>ดอกเบี้ย {Math.round((totalInterest / totalPayment) * 100)}%</span>
                    </span>
                  </div>
                </div>
              )}
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
                <span>ปรึกษาสินเชื่อฟรีก่อนกู้จริง (LINE)</span>
              </a>

              <a
                href="tel:0816040097"
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-white/10"
              >
                <PhoneCall className="w-3.5 h-3.5 text-gold-400" />
                <span>โทรสอบถามคุณฉันทากร: 081-604-0097</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AFFORDABILITY CALCULATOR */}
      {activeTab === 'affordability' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Control 1: Monthly Income */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>รายได้สุทธิประจำต่อเดือน (รวมผู้กู้ร่วมถ้ามี)</span>
                </label>
                <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                  ฿{formatThaiNumber(monthlyIncome)}
                </div>
              </div>
              <input
                type="range"
                min={15000}
                max={200000}
                step={5000}
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[20000, 30000, 45000, 60000, 80000, 120000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMonthlyIncome(val)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      monthlyIncome === val
                        ? 'bg-navy-950 text-gold-400 border-navy-950 font-bold'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    ฿{formatThaiNumber(val)}
                  </button>
                ))}
              </div>
            </div>

            {/* Control 2: Existing Debts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs sm:text-sm font-bold text-navy-950 flex items-center space-x-1.5">
                  <span>ภาระหนี้เดิมต่อเดือน (เช่น ผ่อนรถ, สินเชื่อส่วนบุคคล, บัตรเครดิต)</span>
                </label>
                <div className="text-base sm:text-lg font-black text-rose-600 font-mono">
                  ฿{formatThaiNumber(existingDebt)}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={50000}
                step={1000}
                value={existingDebt}
                onChange={(e) => setExistingDebt(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-950"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>ไม่มีหนี้เดิม (฿0)</span>
                <span>฿10,000</span>
                <span>฿25,000</span>
                <span>฿50,000</span>
              </div>
            </div>

            {/* Control 3: Loan Period & Interest */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-navy-950 block mb-1.5">
                  ระยะเวลากู้ (ปี)
                </label>
                <select
                  value={affordYears}
                  onChange={(e) => setAffordYears(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-bold text-navy-950 focus:bg-white outline-none focus:ring-2 focus:ring-navy-950"
                >
                  <option value={15}>15 ปี</option>
                  <option value={20}>20 ปี</option>
                  <option value={25}>25 ปี</option>
                  <option value={30}>30 ปี (แนะนำสูงสุด)</option>
                  <option value={35}>35 ปี</option>
                  <option value={40}>40 ปี</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-navy-950 block mb-1.5">
                  อัตราดอกเบี้ยเฉลี่ย (% ต่อปี)
                </label>
                <select
                  value={affordInterestRate}
                  onChange={(e) => setAffordInterestRate(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-bold text-navy-950 focus:bg-white outline-none focus:ring-2 focus:ring-navy-950"
                >
                  <option value={3.0}>3.0% (โปรโมชั่นสิทธิพิเศษ)</option>
                  <option value={3.5}>3.5% (อัตราเฉลี่ย 3 ปีแรก)</option>
                  <option value={4.0}>4.0%</option>
                  <option value={5.0}>5.0%</option>
                </select>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed space-y-1">
              <span className="font-bold flex items-center space-x-1.5 text-amber-950">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>เกณฑ์การประเมินสินเชื่อเบื้องต้น</span>
              </span>
              <p className="text-[11px] text-amber-800">
                โดยทั่วไปสถาบันการเงินจะยอมรับภาระหนี้ผ่อนชำระทั้งหมดไม่เกิน 40% – 50% ของรายได้สุทธิ การปิดภาระหนี้เดิมหรือการมีผู้กู้ร่วมที่มีประวัติการเงินดีจะช่วยขยายวงเงินกู้ได้มากขึ้น
              </p>
            </div>
          </div>

          {/* Result Card (5 Cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-emerald-950 via-teal-950 to-navy-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-emerald-900/60 space-y-6">
            <div>
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block mb-1">
                วงเงินกู้ซื้อบ้านสูงสุดที่คาดว่าจะกู้ได้
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                ฿{formatThaiNumber(maxLoanAmount)}
              </div>
              <p className="text-[11px] text-emerald-200 mt-1">
                สำหรับรายได้ ฿{formatThaiNumber(monthlyIncome)}/เดือน (ผ่อนได้สูงสุด ~฿{formatThaiNumber(maxAffordableMonthlyPayment)}/เดือน)
              </p>
            </div>

            {/* Price Range Recommendation */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2">
              <span className="text-xs text-gray-300 font-medium block">
                ราคาบ้าน/อสังหาริมทรัพย์ที่แนะนำ:
              </span>
              <div className="text-xl sm:text-2xl font-black text-gold-300 font-mono">
                ประมาณ ฿{formatThaiNumber(estimatedPropertyBudget)}
              </div>
              <p className="text-[10px] text-gray-400">
                (สมมติฐาน: วงเงินกู้ 90% และผู้ซื้อมีเงินดาวน์หรือส่วนต่าง 10%)
              </p>
            </div>

            {/* Quick Property Search CTA with Budget */}
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <Link
                href={`/properties?maxPrice=${estimatedPropertyBudget}`}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-950 font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg transition-all"
              >
                <Search className="w-4 h-4" />
                <span>ค้นหาทรัพย์ในงบไม่เกิน ฿{(estimatedPropertyBudget / 1000000).toFixed(1)}ลบ.</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <a
                href="https://line.me/R/ti/p/@chantakorn"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-white/10"
              >
                <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                <span>ให้ทีมงานช่วยเช็กวงเงินกู้ธนาคารแบบละเอียดฟรี</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
