'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  X, 
  Building2, 
  MapPin, 
  ExternalLink, 
  Calculator, 
  ShieldCheck, 
  Check, 
  Copy, 
  Sparkles, 
  Info, 
  Layers, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  Loader2,
  Award,
  Globe
} from 'lucide-react';
import { Property } from '@/lib/types';
import { generateLandsMapsParcelInfo, LandsMapsParcelInfo, calculateLandTransferFees } from '@/lib/landsmaps';
import { updateProperty } from '@/lib/store/properties-store';
import { formatPrice, formatPropertyCode } from '@/lib/utils';

interface AdminLandsMapsOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  onPropertyUpdated?: () => void;
}

export default function AdminLandsMapsOverlayModal({
  isOpen,
  onClose,
  property,
  onPropertyUpdated,
}: AdminLandsMapsOverlayModalProps) {
  const [parcelInfo, setParcelInfo] = useState<LandsMapsParcelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSavingSuccess] = useState(false);

  // Editable fields for verification
  const [chanoteNo, setChanoteNo] = useState('');
  const [landNo, setLandNo] = useState('');
  const [surveyPage, setSurveyPage] = useState('');
  const [mapSheet, setMapSheet] = useState('');
  const [appraisalRate, setAppraisalRate] = useState(0);

  useEffect(() => {
    if (isOpen && property) {
      setLoading(true);
      setSavingSuccess(false);

      // Generate or parse initial parcel info
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

      setParcelInfo(info);
      setChanoteNo(info.chanoteNo);
      setLandNo(info.landNo);
      setSurveyPage(info.surveyPage);
      setMapSheet(info.mapSheet);
      setAppraisalRate(info.appraisalPricePerSqWah);
      setLoading(false);
    }
  }, [isOpen, property]);

  if (!isOpen || !property) return null;

  const totalAppraisalVal = Math.round((property.land_size || 50) * appraisalRate);
  const diffPct = totalAppraisalVal > 0 
    ? Math.round(((property.price - totalAppraisalVal) / totalAppraisalVal) * 100) 
    : 0;
  const transferFees = calculateLandTransferFees(property.price, totalAppraisalVal);

  const handleSaveToProperty = async () => {
    if (!property) return;
    setSaving(true);
    try {
      // Append or update verified parcel info inside property description or custom metadata
      const updatedDescription = property.description.includes('📌 ข้อมูลรูปแปลงโฉนดที่ดิน (DOL LandsMaps):')
        ? property.description.replace(
            /📌 ข้อมูลรูปแปลงโฉนดที่ดิน \(DOL LandsMaps\):[\s\S]*/,
            `📌 ข้อมูลรูปแปลงโฉนดที่ดิน (DOL LandsMaps):\n• เลขที่โฉนด: ${chanoteNo}\n• ระวาง: ${mapSheet}\n• เลขที่ดิน: ${landNo} | หน้าสำรวจ: ${surveyPage}\n• ราคาประเมินกรมธนารักษ์: ฿${appraisalRate.toLocaleString()} / ตร.ว. (รวม ฿${totalAppraisalVal.toLocaleString()})`
          )
        : `${property.description}\n\n📌 ข้อมูลรูปแปลงโฉนดที่ดิน (DOL LandsMaps):\n• เลขที่โฉนด: ${chanoteNo}\n• ระวาง: ${mapSheet}\n• เลขที่ดิน: ${landNo} | หน้าสำรวจ: ${surveyPage}\n• ราคาประเมินกรมธนารักษ์: ฿${appraisalRate.toLocaleString()} / ตร.ว. (รวม ฿${totalAppraisalVal.toLocaleString()})`;

      await updateProperty(property.id, {
        description: updatedDescription,
      });

      setSavingSuccess(true);
      if (onPropertyUpdated) onPropertyUpdated();
      setTimeout(() => setSavingSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update property with LandsMaps overlay:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopySummary = () => {
    if (!property || !parcelInfo) return;
    const text = [
      `🗺️ ข้อมูลโฉนดที่ดิน & ราคาประเมินกรมธนารักษ์ (DOL LandsMaps)`,
      `ทรัพย์: ${property.title} (${formatPropertyCode(property.id)})`,
      `• เลขที่โฉนด: ${chanoteNo}`,
      `• ระวาง: ${mapSheet}`,
      `• เลขที่ดิน: ${landNo} | หน้าสำรวจ: ${surveyPage}`,
      `• ทำเล: ต.${property.subdistrict || 'คอหงส์'} อ.${property.district} จ.${property.province}`,
      `• เนื้อที่: ${parcelInfo.rai > 0 ? `${parcelInfo.rai} ไร่ ` : ''}${parcelInfo.ngan > 0 ? `${parcelInfo.ngan} งาน ` : ''}${parcelInfo.sqWah} ตร.ว.`,
      `• ราคาประเมินกรมธนารักษ์: ฿${appraisalRate.toLocaleString()} / ตร.ว. (รวม ฿${totalAppraisalVal.toLocaleString()})`,
      `• ราคาเสนอขายตลาด: ${formatPrice(property.price, property.status)}`,
      `• รวมค่าธรรมเนียมโอน ณ กรมที่ดินประเมิน: ฿${transferFees.totalDepartmentOfLandsFees.toLocaleString()}`,
      `🌐 ดูรูปแปลงบน DOL LandsMaps: ${parcelInfo.landsmapsUrl}`,
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 to-blue-950 text-white flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-navy-900 border border-gold-500/40 flex-shrink-0">
              <Image
                src={property.cover_image}
                alt={property.title}
                fill
                unoptimized
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold bg-gold-500/20 text-gold-300 px-1.5 py-0.2 rounded border border-gold-500/30">
                  {formatPropertyCode(property.id)}
                </span>
                <span className="text-xs text-gray-300 truncate">
                  {property.district}, {property.province}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
                DOL LandsMaps Overlay: {property.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Status Alert Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-extrabold text-emerald-950">เชื่อมโยงพิกัดรูปแปลงกับกรมที่ดิน (DOL LandsMaps)</span>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  ระบบทำการดึงระวาง, ราคาประเมินกรมธนารักษ์ และคำนวณค่าโอนอัตโนมัติตามพิกัด {property.district}
                </p>
              </div>
            </div>

            <a
              href={parcelInfo?.landsmapsUrl || 'https://landsmaps.dol.go.th/'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer flex-shrink-0"
            >
              <span>เปิด DOL LandsMaps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Verification & Edit Fields */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-navy-950 text-xs sm:text-sm flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-gold-600" />
                <span>ยืนยันข้อมูลโฉนดที่ดิน & ราคาประเมินราชการ:</span>
              </h3>
              <span className="text-[10px] text-gray-500">สามารถแก้ไขตัวเลขโฉนดจริงเพื่ออัปเดตลงระบบ</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">เลขที่โฉนดที่ดิน</label>
                <input
                  type="text"
                  value={chanoteNo}
                  onChange={(e) => setChanoteNo(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">ระวาง</label>
                <input
                  type="text"
                  value={mapSheet}
                  onChange={(e) => setMapSheet(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">เลขที่ดิน</label>
                <input
                  type="text"
                  value={landNo}
                  onChange={(e) => setLandNo(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">หน้าสำรวจ</label>
                <input
                  type="text"
                  value={surveyPage}
                  onChange={(e) => setSurveyPage(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-200">
              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">
                  อัตราประเมินกรมธนารักษ์ (บาท / ตร.ว.)
                </label>
                <input
                  type="number"
                  value={appraisalRate}
                  onChange={(e) => setAppraisalRate(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-600 block mb-1">
                  รวมราคาประเมินทุนทรัพย์ราชการ
                </label>
                <div className="w-full bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-black text-navy-950">
                  ฿{totalAppraisalVal.toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">({property.land_size || 50} ตร.ว.)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Valuation & Transfer Fees Analysis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Price Comparison */}
            <div className="bg-white p-4 rounded-2xl border border-gold-300/80 shadow-2xs space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-navy-950">
                <Award className="w-4 h-4 text-gold-600" />
                <span>เปรียบเทียบราคาประเมิน vs ราคาขาย</span>
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">ราคาเสนอขายตลาด:</span>
                  <strong className="text-navy-950">{formatPrice(property.price, property.status)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">รวมราคาประเมินกรมธนารักษ์:</span>
                  <strong className="text-navy-950">฿{totalAppraisalVal.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100 font-bold">
                  <span className="text-gray-700">ส่วนต่างราคาตลาด:</span>
                  <span className={diffPct > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {diffPct > 0 ? `+${diffPct}% จากราคาประเมิน` : 'ใกล้เคียงราคาประเมิน'}
                  </span>
                </div>
              </div>
            </div>

            {/* Department of Lands Transfer Fees */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-navy-950">
                <Calculator className="w-4 h-4 text-navy-800" />
                <span>ประมาณการค่าธรรมเนียมโอน ณ สำนักงานที่ดิน</span>
              </div>

              <div className="space-y-1 pt-1 text-[11px] text-gray-600">
                <div className="flex justify-between">
                  <span>• ค่าธรรมเนียมโอน 2%:</span>
                  <strong>฿{transferFees.transferFee.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>• ภาษีหัก ณ ที่จ่ายประเมิน:</span>
                  <strong>฿{transferFees.withholdingTax.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>• อากรแสตมป์ (0.5%):</span>
                  <strong>฿{transferFees.stampDutyOrBusinessTax.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100 font-extrabold text-navy-950 text-xs">
                  <span>รวมค่าใช้จ่ายประเมิน:</span>
                  <span>฿{transferFees.totalDepartmentOfLandsFees.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Toast Notification */}
          {saveSuccess && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ซิงก์ข้อมูลโฉนดที่ดินและราคาประเมินลงรายละเอียดทรัพย์เรียบร้อยแล้ว!</span>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 flex items-center gap-1 cursor-pointer transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกสเปกโฉนด'}</span>
            </button>

            <a
              href={parcelInfo?.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-white hover:bg-gray-100 text-navy-950 font-bold text-xs rounded-xl border border-gray-200 flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>Google Maps</span>
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-600 font-semibold text-xs rounded-xl border border-gray-300 hover:bg-gray-100"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSaveToProperty}
              disabled={saving}
              className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-gold-400" /> : <Save className="w-4 h-4 text-gold-400" />}
              <span>ซิงก์สเปกโฉนดลงประกาศ</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
