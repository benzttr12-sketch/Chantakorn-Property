'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  X, 
  Scale, 
  Bed, 
  Bath, 
  Car, 
  Maximize, 
  MapPin, 
  Video, 
  ExternalLink, 
  Phone, 
  Check, 
  Trash2,
  Sparkles
} from 'lucide-react';
import { Property } from '@/lib/types';
import { formatPrice, formatThaiNumber, getPropertyTypeName, formatPropertyCode } from '@/lib/utils';
import { propertyHref } from '@/components/properties/property-link';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function CompareModal({
  isOpen,
  onClose,
  properties,
  onRemove,
  onClear,
}: CompareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-navy-950 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gold-500/20 border border-gold-400/30 flex items-center justify-center text-gold-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white flex items-center space-x-2">
                <span>ตารางเปรียบเทียบอสังหาริมทรัพย์</span>
                <span className="text-xs bg-gold-500 text-navy-950 font-black px-2 py-0.5 rounded-md">
                  {properties.length} รายการ
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                เปรียบเทียบสเปก ราคา ทำเล และจุดเด่นแบบเคียงข้างกันเพื่อช่วยให้คุณตัดสินใจได้ง่ายขึ้น
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {properties.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-gray-400 hover:text-red-400 px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-400/40 transition-colors flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ล้างทั้งหมด</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable comparison table */}
        <div className="p-4 sm:p-6 overflow-x-auto overflow-y-auto flex-1">
          {properties.length === 0 ? (
            <div className="py-16 text-center text-gray-500 space-y-3">
              <Scale className="w-12 h-12 text-gray-300 mx-auto stroke-[1.5]" />
              <p className="font-bold text-base text-navy-950">ยังไม่มีรายการที่เลือกเปรียบเทียบ</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                กดไอคอนตราชั่ง (เปรียบเทียบ) ที่การ์ดอสังหาริมทรัพย์เพื่อเลือกเปรียบเทียบได้สูงสุด 4 หลังพร้อมกัน
              </p>
            </div>
          ) : (
            <div className="min-w-[680px]">
              {/* Properties Grid Headers */}
              <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                {/* Blank top-left cell */}
                <div className="flex flex-col justify-end pb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    คุณสมบัติ / ข้อมูล
                  </span>
                </div>

                {/* Property Header Cards */}
                {properties.map((prop) => (
                  <div key={prop.id} className="bg-gray-50 rounded-2xl p-3 border border-gray-200 relative group flex flex-col justify-between">
                    <button
                      type="button"
                      onClick={() => onRemove(prop.id)}
                      className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/60 text-white hover:bg-red-600 flex items-center justify-center text-xs transition-colors shadow"
                      title="ลบออกจากการเปรียบเทียบ"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div>
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2 bg-gray-200">
                        <Image
                          src={prop.cover_image || prop.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80'}
                          alt={prop.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 25vw"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 left-2 bg-navy-950/80 text-gold-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                          {formatPropertyCode(prop.id)}
                        </div>
                        {prop.video_url && (
                          <div className="absolute bottom-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-1">
                            <Video className="w-2.5 h-2.5" />
                            <span>มีวิดีโอ</span>
                          </div>
                        )}
                      </div>

                      <h4 className="font-bold text-xs text-navy-950 line-clamp-2 mb-1.5 min-h-[32px]">
                        {prop.title}
                      </h4>

                      <div className="text-base font-black text-gold-600 font-mono mb-2">
                        {formatPrice(prop.price)}
                      </div>
                    </div>

                    <Link
                      href={propertyHref(prop.slug || prop.id)}
                      target="_blank"
                      className="w-full py-2 bg-navy-950 hover:bg-navy-900 text-white text-xs font-bold rounded-xl text-center flex items-center justify-center space-x-1 transition-colors"
                    >
                      <span>ดูรายละเอียด</span>
                      <ExternalLink className="w-3 h-3 text-gold-400" />
                    </Link>
                  </div>
                ))}
              </div>

              {/* Rows Comparison */}
              <div className="space-y-1.5 text-xs">
                {/* Row: สถานะ & ประเภท */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50/80 border-b border-gray-100" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950">ประเภทอสังหาฯ</span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700 font-medium">
                      {getPropertyTypeName(p.property_type)} ({p.status === 'sale' ? 'ขาย' : 'ให้เช่า'})
                    </span>
                  ))}
                </div>

                {/* Row: ทำเล / อำเภอ */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-gray-50/60" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950 flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-gold-600" />
                    <span>ทำเลที่ตั้ง</span>
                  </span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700 font-semibold">
                      {p.district ? `อ.${p.district}` : ''} {p.province ? `จ.${p.province}` : ''}
                    </span>
                  ))}
                </div>

                {/* Row: ขนาดที่ดิน */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50/80 border-b border-gray-100" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950">ขนาดที่ดิน</span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700 font-mono font-medium">
                      {p.land_size > 0 ? `${formatThaiNumber(p.land_size)} ตร.ว.` : '-'}
                    </span>
                  ))}
                </div>

                {/* Row: พื้นที่ใช้สอย */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-gray-50/60" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950 flex items-center space-x-1">
                    <Maximize className="w-3.5 h-3.5 text-gray-500" />
                    <span>พื้นที่ใช้สอย</span>
                  </span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700 font-mono font-medium">
                      {p.usable_area > 0 ? `${formatThaiNumber(p.usable_area)} ตร.ม.` : '-'}
                    </span>
                  ))}
                </div>

                {/* Row: ห้องนอน */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50/80 border-b border-gray-100" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950 flex items-center space-x-1">
                    <Bed className="w-3.5 h-3.5 text-gray-500" />
                    <span>ห้องนอน</span>
                  </span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700 font-bold">
                      {p.bedrooms > 0 ? `${p.bedrooms} ห้อง` : '-'}
                    </span>
                  ))}
                </div>

                {/* Row: ห้องน้ำ */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-gray-50/60" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950 flex items-center space-x-1">
                    <Bath className="w-3.5 h-3.5 text-gray-500" />
                    <span>ห้องน้ำ</span>
                  </span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700 font-bold">
                      {p.bathrooms > 0 ? `${p.bathrooms} ห้อง` : '-'}
                    </span>
                  ))}
                </div>

                {/* Row: ที่จอดรถ */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50/80 border-b border-gray-100" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950 flex items-center space-x-1">
                    <Car className="w-3.5 h-3.5 text-gray-500" />
                    <span>ที่จอดรถ</span>
                  </span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700">
                      {p.parking && p.parking > 0 ? `${p.parking} คัน` : '-'}
                    </span>
                  ))}
                </div>

                {/* Row: วิดีโอพาทัวร์ */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-gray-50/60" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950 flex items-center space-x-1">
                    <Video className="w-3.5 h-3.5 text-red-500" />
                    <span>วิดีโอพาทัวร์</span>
                  </span>
                  {properties.map((p) => (
                    <span key={p.id} className="text-gray-700">
                      {p.video_url ? (
                        <span className="text-emerald-700 font-bold flex items-center space-x-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>มีคลิปวิดีโอ</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">ยังไม่มี</span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Row: นายหน้าผู้ดูแล */}
                <div className="grid gap-4 py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50/80 border-b border-gray-100" style={{ gridTemplateColumns: `180px repeat(${properties.length}, minmax(200px, 1fr))` }}>
                  <span className="font-bold text-navy-950">นายหน้าดูแล</span>
                  {properties.map((p) => (
                    <div key={p.id} className="text-gray-700 text-xs">
                      <p className="font-bold text-navy-950">{p.agent?.name || 'Chantakorn Property'}</p>
                      <a href={`tel:${p.agent?.phone || '0816040097'}`} className="text-gold-700 hover:underline font-mono text-[11px] block mt-0.5">
                        📞 {p.agent?.phone || '081-604-0097'}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-gray-500">
            * ข้อมูลสเปกและราคาอาจมีการเปลี่ยนแปลง ติดต่อสอบถามนายหน้าผู้ดูแลเพื่อรับข้อมูลอัปเดตล่าสุด
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-white font-bold rounded-xl transition-colors"
          >
            ปิดหน้าต่างเปรียบเทียบ
          </button>
        </div>
      </div>
    </div>
  );
}
