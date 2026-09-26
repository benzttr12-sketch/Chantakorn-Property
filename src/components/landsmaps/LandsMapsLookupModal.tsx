'use client';

import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Building2, 
  MapPin, 
  ExternalLink, 
  Calculator, 
  Check, 
  Copy, 
  ShieldCheck, 
  Compass, 
  Sparkles, 
  Info, 
  Layers, 
  RefreshCw,
  Award
} from 'lucide-react';
import { DISTRICTS_LIST } from '@/lib/utils';
import { generateLandsMapsParcelInfo } from '@/lib/landsmaps';

interface LandsMapsLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LandsMapsLookupModal({ isOpen, onClose }: LandsMapsLookupModalProps) {
  const [province, setProvince] = useState('สงขลา');
  const [district, setDistrict] = useState('หาดใหญ่');
  const [subdistrict, setSubdistrict] = useState('คอหงส์');
  const [chanoteNoInput, setChanoteNoInput] = useState('12345');
  const [landSizeInput, setLandSizeInput] = useState('80');
  const [estimatedPriceInput, setEstimatedPriceInput] = useState('4500000');
  const [copied, setCopied] = useState(false);

  // Computed result
  const [searchedInfo, setSearchedInfo] = useState(() => 
    generateLandsMapsParcelInfo(
      'search_id_01',
      'หาดใหญ่',
      'สงขลา',
      'คอหงส์',
      80,
      4500000,
      7.008,
      100.474,
      '12345'
    )
  );

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const size = parseFloat(landSizeInput) || 50;
    const price = parseFloat(estimatedPriceInput) || 3000000;
    
    // Lat / Lng for Hat Yai / Songkhla
    let lat = 7.008;
    let lng = 100.474;
    if (district.includes('เมืองสงขลา')) {
      lat = 7.198;
      lng = 100.595;
    } else if (district.includes('สะเดา')) {
      lat = 6.638;
      lng = 100.422;
    }

    const info = generateLandsMapsParcelInfo(
      `search_${chanoteNoInput}`,
      district,
      province,
      subdistrict,
      size,
      price,
      lat,
      lng,
      chanoteNoInput || '12345'
    );
    setSearchedInfo(info);
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(searchedInfo.landsmapsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePresetZone = (zoneDistrict: string, zoneSubdistrict: string, defaultChanote: string) => {
    setDistrict(zoneDistrict);
    setSubdistrict(zoneSubdistrict);
    setChanoteNoInput(defaultChanote);
    
    const info = generateLandsMapsParcelInfo(
      `search_${defaultChanote}`,
      zoneDistrict,
      'สงขลา',
      zoneSubdistrict,
      parseFloat(landSizeInput) || 80,
      parseFloat(estimatedPriceInput) || 4500000,
      7.008,
      100.474,
      defaultChanote
    );
    setSearchedInfo(info);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 to-blue-950 text-white flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gold-500/20 text-gold-400 flex items-center justify-center font-bold border border-gold-500/40">
              <Building2 className="w-6 h-6 text-gold-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  ค้นหารูปแปลง & โฉนดที่ดิน กรมที่ดิน (DOL LandsMaps)
                </h2>
                <span className="bg-gold-500 text-navy-950 text-[10px] font-black px-2 py-0.5 rounded-full hidden sm:inline-block">
                  DOL Official Link
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                ตรวจสอบตำแหน่งรูปแปลง, ราคาประเมินทุนทรัพย์กรมธนารักษ์ และภาษีค่าโอน ณ สำนักงานที่ดิน
              </p>
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Quick Preset Zone Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-navy-950 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-gold-600" />
              <span>เลือกโซนยอดนิยมในสงขลา - หาดใหญ่ เพื่อค้นหาด่วน:</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handlePresetZone('หาดใหญ่', 'คอหงส์', '45892')}
                className="px-2.5 py-1 bg-gold-50 hover:bg-gold-100 text-navy-950 text-xs font-bold rounded-lg border border-gold-300 transition-all cursor-pointer"
              >
                📍 หาดใหญ่ (คอหงส์ ม.อ.)
              </button>
              <button
                type="button"
                onClick={() => handlePresetZone('หาดใหญ่', 'คลองแห', '23104')}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-navy-950 text-xs font-semibold rounded-lg border border-gray-200 transition-all cursor-pointer"
              >
                📍 หาดใหญ่ (คลองแห)
              </button>
              <button
                type="button"
                onClick={() => handlePresetZone('หาดใหญ่', 'บ้านพรุ', '18940')}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-navy-950 text-xs font-semibold rounded-lg border border-gray-200 transition-all cursor-pointer"
              >
                📍 หาดใหญ่ (บ้านพรุ)
              </button>
              <button
                type="button"
                onClick={() => handlePresetZone('เมืองสงขลา', 'เขารูปช้าง', '67201')}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-navy-950 text-xs font-semibold rounded-lg border border-gray-200 transition-all cursor-pointer"
              >
                📍 เมืองสงขลา (เขารูปช้าง)
              </button>
              <button
                type="button"
                onClick={() => handlePresetZone('สะเดา', 'สะเดา', '88120')}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-navy-950 text-xs font-semibold rounded-lg border border-gray-200 transition-all cursor-pointer"
              >
                📍 สะเดา (ด่านนอก)
              </button>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">จังหวัด</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  placeholder="สงขลา"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">อำเภอ</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none cursor-pointer"
                >
                  {DISTRICTS_LIST.map((dist) => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">เลขที่โฉนดที่ดิน</label>
                <input
                  type="text"
                  value={chanoteNoInput}
                  onChange={(e) => setChanoteNoInput(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  placeholder="เช่น 12345"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">เนื้อที่รวม (ตารางวา)</label>
                <input
                  type="number"
                  value={landSizeInput}
                  onChange={(e) => setLandSizeInput(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  placeholder="80"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">ราคาเสนอขายเปรียบเทียบ (บาท)</label>
                <input
                  type="number"
                  value={estimatedPriceInput}
                  onChange={(e) => setEstimatedPriceInput(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  placeholder="4500000"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-98"
            >
              <Search className="w-4 h-4 text-gold-400" />
              <span>ประมวลผลรูปแปลง & ดึงสเปกโฉนดที่ดิน</span>
            </button>
          </form>

          {/* Searched Results Sheet */}
          <div className="bg-white rounded-2xl border border-gold-500/30 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-navy-950 text-sm sm:text-base">
                  ผลการประมวลผลรูปแปลงโฉนดที่ดินเลขที่ #{searchedInfo.chanoteNo}
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                กรมที่ดิน DOL Ready
              </span>
            </div>

            {/* Spec Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="text-[10px] text-gray-500">เลขที่โฉนด / ระวาง</div>
                <div className="text-xs font-black font-mono text-navy-950 mt-0.5">
                  #{searchedInfo.chanoteNo}
                </div>
                <div className="text-[9px] text-gray-400 truncate mt-0.5">ระวาง {searchedInfo.mapSheet}</div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="text-[10px] text-gray-500">เนื้อที่คำนวณ</div>
                <div className="text-xs font-black text-navy-950 mt-0.5">
                  {searchedInfo.rai > 0 && `${searchedInfo.rai} ไร่ `}{searchedInfo.ngan > 0 && `${searchedInfo.ngan} งาน `}{searchedInfo.sqWah} ตร.ว.
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">({searchedInfo.totalSqMeters.toLocaleString()} ตร.ม.)</div>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <div className="text-[10px] text-amber-900 font-semibold">ราคาประเมินต่อ ตร.ว.</div>
                <div className="text-xs font-black text-navy-950 mt-0.5">
                  ฿{searchedInfo.appraisalPricePerSqWah.toLocaleString()} / ตร.ว.
                </div>
                <div className="text-[9px] text-amber-800 mt-0.5">ฐานประเมินกรมธนารักษ์</div>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <div className="text-[10px] text-amber-900 font-semibold">รวมราคาประเมินทุนทรัพย์</div>
                <div className="text-xs font-black text-navy-950 mt-0.5">
                  ฿{searchedInfo.totalAppraisalValue.toLocaleString()}
                </div>
                <div className="text-[9px] text-amber-800 mt-0.5">ใช้คิดค่าธรรมเนียมโอน</div>
              </div>
            </div>

            {/* Tax & Transfer Fees Calculation */}
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-navy-950">
                <span className="flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-navy-800" />
                  <span>สรุปค่าธรรมเนียม & ภาษีประเมิน ณ สำนักงานที่ดิน:</span>
                </span>
                <span className="text-sm font-black text-navy-950">
                  ฿{searchedInfo.transferFees.totalDepartmentOfLandsFees.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-600 pt-1 border-t border-gray-200">
                <div>• ค่าธรรมเนียมโอน 2%: <strong>฿{searchedInfo.transferFees.transferFee.toLocaleString()}</strong></div>
                <div>• ภาษีหัก ณ ที่จ่าย: <strong>฿{searchedInfo.transferFees.withholdingTax.toLocaleString()}</strong></div>
                <div>• อากรแสตมป์ 0.5%: <strong>฿{searchedInfo.transferFees.stampDutyOrBusinessTax.toLocaleString()}</strong></div>
              </div>
            </div>

            {/* Launch Links */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-navy-950 font-bold text-xs rounded-xl border border-gray-200 flex items-center justify-center space-x-1 transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                  <span>{copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ LandsMaps'}</span>
                </button>

                <a
                  href={searchedInfo.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-white hover:bg-gray-50 text-navy-950 font-bold text-xs rounded-xl border border-gray-300 flex items-center justify-center space-x-1 transition-all"
                >
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  <span>เปิด Google Maps</span>
                </a>
              </div>

              <a
                href={searchedInfo.landsmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-gradient-to-r from-navy-950 to-blue-900 hover:from-navy-900 hover:to-blue-800 text-gold-300 font-black text-xs rounded-xl shadow-md border border-gold-500/40 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95"
              >
                <span>🚀 เปิดดูรูปแปลงที่ดินจริงบน DOL LandsMaps</span>
                <ExternalLink className="w-4 h-4 text-gold-400" />
              </a>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-gold-600" />
            <span>เชื่อมโยงข้อมูลกับระบบค้นหารูปแปลงที่ดิน กรมที่ดิน (https://landsmaps.dol.go.th/)</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
}
