'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Phone, 
  MessageCircle, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Filter,
  User
} from 'lucide-react';
import { fetchInquiries, updateInquiryStatus } from '@/lib/store/properties-store';
import { Inquiry } from '@/lib/types';
import { formatThaiDate } from '@/lib/utils';

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'contacted' | 'closed'>('all');

  useEffect(() => {
    let active = true;
    fetchInquiries().then(list => { if (active) setInquiries(list); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: Inquiry['status']) => {
    if (busyId) return;
    setBusyId(id); setError('');
    try {
      const saved = await updateInquiryStatus(id, newStatus);
      if (!saved) throw new Error('ไม่พบรายการผู้ติดต่อนี้');
      setInquiries(current => current.map(inquiry => inquiry.id === id ? saved : inquiry));
    } catch (err) { setError(err instanceof Error ? err.message : 'บันทึกสถานะไม่สำเร็จ'); }
    finally { setBusyId(null); }
  };

  const filtered = inquiries.filter((inq) => {
    if (statusFilter !== 'all' && inq.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">รายการผู้ติดต่อ & ฝากขายทรัพย์</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            ระบบจัดการข้อความ ลูกค้าที่นัดชมทรัพย์ และรายการที่เจ้าของทรัพย์ส่งมาฝากขาย
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'all' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            ทั้งหมด ({inquiries.length})
          </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'new' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            รอดำเนินการ ({inquiries.filter((i) => i.status === 'new').length})
          </button>
          <button
            onClick={() => setStatusFilter('contacted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'contacted' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            ติดต่อแล้ว ({inquiries.filter((i) => i.status === 'contacted').length})
          </button>
        </div>
      </div>

      {/* Inquiries Cards List */}
      <div className="space-y-4">
        {loading ? <p role="status" className="p-8 text-center">กำลังโหลดรายการผู้ติดต่อ...</p> : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-surface-border">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-navy-950 text-base">ไม่พบรายการผู้ติดต่อในสถานะนี้</h3>
          </div>
        ) : (
          filtered.map((inq) => (
            <div
              key={inq.id}
              className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-6"
            >
              {/* Left Details */}
              <div className="space-y-3 flex-grow max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    inq.status === 'new'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {{ new: '• รอดำเนินการ (ใหม่)', contacted: '✓ ติดต่อลูกค้าแล้ว', scheduled: 'นัดหมายแล้ว', closed: 'ปิดรายการแล้ว' }[inq.status]}
                  </span>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                    {inq.inquiry_type === 'viewing'
                      ? 'นัดหมายเข้าชมสถานที่จริง'
                      : inq.inquiry_type === 'consignment_sell'
                      ? 'ฝากขายบ้าน / ที่ดิน'
                      : 'สอบถามรายละเอียดทรัพย์'}
                  </span>

                  <span className="text-[11px] text-gray-400 ml-auto flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatThaiDate(inq.created_at)}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-navy-950 flex items-center space-x-2">
                    <User className="w-4 h-4 text-gold-600" />
                    <span>{inq.name}</span>
                  </h3>
                  {inq.property_title && (
                    <div className="text-xs text-gold-700 font-semibold mt-0.5">
                      อสังหาริมทรัพย์ที่สนใจ: {inq.property_title}
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl text-xs text-gray-800 leading-relaxed whitespace-pre-line border border-gray-100">
                  {inq.message}
                </div>

                {inq.consignment_details && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-gray-600 bg-gold-50/60 p-3 rounded-xl border border-gold-200">
                    <div>
                      <span className="text-gray-400 block">ประเภท:</span>
                      <strong className="text-navy-950">{inq.consignment_details.property_type}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ทำเล:</span>
                      <strong className="text-navy-950">{inq.consignment_details.district}, {inq.consignment_details.province}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ราคาที่ต้องการ:</span>
                      <strong className="text-gold-700">฿{new Intl.NumberFormat('th-TH').format(inq.consignment_details.expected_price)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">รูปถ่ายที่แนบ:</span>
                      <strong className="text-navy-950">{inq.consignment_details.photos_count || 0} ภาพ</strong>
                    </div>
                  </div>
                )}
              </div>

              {inq.consignment_details?.photos?.length ? <div className="flex flex-wrap gap-2">{inq.consignment_details.photos.map((photo, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={index} src={photo} alt={'รูปทรัพย์ที่แนบ ' + (index + 1)} className="h-24 w-32 rounded-lg object-cover" />
              ))}</div> : null}
              {/* Right Action Buttons */}
              <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 space-y-3 flex-shrink-0 md:w-56">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    ช่องทางติดต่อกลับ
                  </span>
                  <a
                    href={`tel:${inq.phone}`}
                    className="w-full py-2 px-3 bg-navy-950 hover:bg-navy-900 text-gold-400 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>โทร: {inq.phone}</span>
                  </a>

                  {inq.line_id && (
                    <a
                      href={`https://line.me/R/ti/p/${inq.line_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      <span>LINE: {inq.line_id}</span>
                    </a>
                  )}
                </div>

                <div className="pt-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    เปลี่ยนสถานะ
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      disabled={busyId !== null} onClick={() => handleUpdateStatus(inq.id, 'contacted')}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                        inq.status === 'contacted'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-800'
                      }`}
                    >
                      ติดต่อแล้ว
                    </button>
                    <button
                      disabled={busyId !== null} onClick={() => handleUpdateStatus(inq.id, 'closed')}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                        inq.status === 'closed'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-800'
                      }`}
                    >
                      ปิดงาน
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
