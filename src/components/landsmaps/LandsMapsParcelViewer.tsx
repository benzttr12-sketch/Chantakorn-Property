'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  ExternalLink, 
  Calculator, 
  ShieldCheck, 
  CheckCircle2, 
  Info, 
  Sparkles, 
  Compass, 
  FileText, 
  Layers, 
  Maximize2,
  HelpCircle,
  Award
} from 'lucide-react';
import { Property } from '@/lib/types';
import { generateLandsMapsParcelInfo, calculateLandTransferFees } from '@/lib/landsmaps';
import { formatPrice } from '@/lib/utils';

interface LandsMapsParcelViewerProps {
  property: Property;
}

export default function LandsMapsParcelViewer({ property }: LandsMapsParcelViewerProps) {
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [isOwnedOver5Years, setIsOwnedOver5Years] = useState(true);

  // Generate parcel info
  const info = generateLandsMapsParcelInfo(
    property.id,
    property.district,
    property.province,
    property.subdistrict || 'คอหงส์',
    property.land_size || 50,
    property.price,
    property.latitude || 7.008,
    property.longitude || 100.474
  );

  const customFees = calculateLandTransferFees(property.price, info.totalAppraisalValue, isOwnedOver5Years);

  return (
    <div className="bg-white rounded-3xl border border-gold-500/30 shadow-md p-5 sm:p-7 space-y-6 overflow-hidden relative">
      {/* Top Banner Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy-950 to-blue-900 text-gold-400 flex items-center justify-center font-bold shadow-md border border-gold-500/40 flex-shrink-0">
            <Building2 className="w-6 h-6 text-gold-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-navy-950 text-base sm:text-lg">
                ข้อมูลรูปแปลงที่ดิน & ราคาประเมินราชการ
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-emerald-300">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>DOL LandsMaps Verified</span>
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              เชื่อมโยงข้อมูลรูปแปลงและราคาประเมินทุนทรัพย์กรมธนารักษ์ กรมที่ดิน (Department of Lands)
            </p>
          </div>
        </div>

        {/* Deep Link to DOL LandsMaps */}
        <a
          href={info.landsmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-gradient-to-r from-navy-950 to-blue-900 hover:from-navy-900 hover:to-blue-800 text-gold-300 font-bold text-xs rounded-xl shadow-sm border border-gold-500/40 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 flex-shrink-0"
        >
          <span>🗺️ เปิดรูปแปลงบน DOL LandsMaps</span>
          <ExternalLink className="w-3.5 h-3.5 text-gold-400" />
        </a>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">เลขที่โฉนดที่ดิน</div>
          <div className="text-sm font-black font-mono text-navy-950 mt-1">
            {info.chanoteNo}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">ระวาง {info.mapSheet}</div>
        </div>

        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">เนื้อที่ตามโฉนด</div>
          <div className="text-sm font-black text-navy-950 mt-1">
            {info.rai > 0 && `${info.rai} ไร่ `}{info.ngan > 0 && `${info.ngan} งาน `}{info.sqWah} ตร.ว.
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">({info.totalSqMeters.toLocaleString()} ตร.ม.)</div>
        </div>

        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">หน้าสำรวจ / เลขที่ดิน</div>
          <div className="text-sm font-black font-mono text-navy-950 mt-1">
            {info.surveyPage} / {info.landNo}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">ต.{info.subdistrict} อ.{info.district}</div>
        </div>

        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">ตำแหน่งพิกัด GPS</div>
          <div className="text-xs font-bold font-mono text-navy-950 mt-1 truncate">
            {info.latitude.toFixed(4)}, {info.longitude.toFixed(4)}
          </div>
          <a
            href={info.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
          >
            <span>ดูบน Google Maps</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* Treasury Valuation Comparison */}
      <div className="bg-gradient-to-br from-amber-50/90 to-gold-50/70 rounded-2xl p-4 sm:p-5 border border-gold-300/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-gold-600" />
            <h4 className="font-extrabold text-navy-950 text-sm">
              ประเมินทุนทรัพย์ราชการ (กรมธนารักษ์) vs ราคาเสนอขาย
            </h4>
          </div>
          <span className="text-[10px] font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md">
            อัตราประเมินทำเล{info.district}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white/90 p-3 rounded-xl border border-gold-200">
            <div className="text-[11px] text-gray-500 font-semibold">ราคาประเมินต่อ ตร.ว.</div>
            <div className="text-base font-extrabold text-navy-950 mt-0.5">
              ฿{info.appraisalPricePerSqWah.toLocaleString()} <span className="text-xs font-normal text-gray-500">/ ตร.ว.</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">ฐานกรมธนารักษ์รอบล่าสุด</div>
          </div>

          <div className="bg-white/90 p-3 rounded-xl border border-gold-200">
            <div className="text-[11px] text-gray-500 font-semibold">รวมราคาประเมินทุนทรัพย์</div>
            <div className="text-base font-extrabold text-navy-950 mt-0.5">
              ฿{info.totalAppraisalValue.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">ใช้คิดค่าธรรมเนียมโอน ณ สำนักงานที่ดิน</div>
          </div>

          <div className="bg-navy-950 text-white p-3 rounded-xl border border-gold-500/40">
            <div className="text-[11px] text-gold-300 font-semibold">ราคาเสนอขายตลาด</div>
            <div className="text-base font-extrabold text-gold-400 mt-0.5">
              {formatPrice(property.price, property.status)}
            </div>
            <div className="text-[10px] text-gray-300 mt-0.5">
              {info.diffPercentage > 0 ? `สูงกว่าราคาประเมิน +${info.diffPercentage}% (ตามราคาตลาด)` : 'ใกล้เคียงราคาประเมินราชการ'}
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Fee & Tax Calculator Panel */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-navy-900" />
            <h4 className="font-extrabold text-navy-950 text-xs sm:text-sm">
              ประมาณการค่าธรรมเนียม & ภาษีการโอน ณ สำนักงานที่ดิน
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
            className="text-xs font-bold text-navy-950 hover:text-gold-600 underline cursor-pointer"
          >
            {showTaxBreakdown ? 'ซ่อนรายละเอียด' : 'ดูแจกแจงค่าใช้จ่าย'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-gray-200">
          <div>
            <span className="text-xs text-gray-600">รวมค่าใช้จ่ายประเมิน ณ กรมที่ดิน: </span>
            <span className="text-sm font-extrabold text-navy-950 ml-1">
              ฿{customFees.totalDepartmentOfLandsFees.toLocaleString()}
            </span>
          </div>

          {/* Toggle ownership duration */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-500 text-[11px]">ถือครองเกิน 5 ปี หรือมีชื่อในทะเบียนบ้านเกิน 1 ปี:</span>
            <button
              type="button"
              onClick={() => setIsOwnedOver5Years(!isOwnedOver5Years)}
              className={`px-2 py-0.5 rounded-md font-bold text-[10px] transition-all cursor-pointer ${
                isOwnedOver5Years
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isOwnedOver5Years ? 'ใช่ (เสียอากรแสตมป์ 0.5%)' : 'ไม่ถึง (เสียภาษีธุรกิจเฉพาะ 3.3%)'}
            </button>
          </div>
        </div>

        {/* Detailed Breakdown */}
        {showTaxBreakdown && (
          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs animate-in fade-in duration-150">
            <div className="bg-white p-2.5 rounded-xl border border-gray-200">
              <div className="text-gray-500 text-[11px]">1. ค่าธรรมเนียมโอน (2%)</div>
              <div className="font-bold text-navy-950 mt-0.5">
                ฿{customFees.transferFee.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400">คิดจากราคาประเมินราชการ</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-gray-200">
              <div className="text-gray-500 text-[11px]">2. ภาษีหัก ณ ที่จ่ายประเมิน</div>
              <div className="font-bold text-navy-950 mt-0.5">
                ฿{customFees.withholdingTax.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400">ประเมินบุคคลธรรมดา</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-gray-200">
              <div className="text-gray-500 text-[11px]">
                3. {customFees.isSpecificBusinessTax ? 'ภาษีธุรกิจเฉพาะ (3.3%)' : 'อากรแสตมป์ (0.5%)'}
              </div>
              <div className="font-bold text-navy-950 mt-0.5">
                ฿{customFees.stampDutyOrBusinessTax.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400">คิดจากราคาประเมินหรือราคาขายที่สูงกว่า</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Note */}
      <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-gold-600 flex-shrink-0" />
          <span>ข้อมูลเพื่อการอ้างอิงและประเมินเบื้องต้น สามารถตรวจสอบรูปแปลงจริงได้ที่ระบบ LandsMaps กรมที่ดิน</span>
        </span>
        <a
          href={info.landsmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-navy-950 font-bold hover:text-gold-600 inline-flex items-center gap-1"
        >
          <span>https://landsmaps.dol.go.th</span>
          <ExternalLink className="w-3 h-3 text-gold-600" />
        </a>
      </div>
    </div>
  );
}
