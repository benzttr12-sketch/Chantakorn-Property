'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Tag, 
  Key, 
  MessageSquare, 
  TrendingUp, 
  PlusCircle, 
  ArrowUpRight, 
  Eye, 
  CheckCircle,
  Clock
} from 'lucide-react';
import { fetchAdminProperties, fetchInquiries } from '@/lib/store/properties-store';
import { Property, Inquiry } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

export default function AdminDashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [p, inq] = await Promise.all([fetchAdminProperties(), fetchInquiries()]);
        setProperties(p); setInquiries(inq);
      } catch (err) { setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const totalListings = properties.length;
  const saleListings = properties.filter((p) => p.status === 'sale').length;
  const rentListings = properties.filter((p) => p.status === 'rent').length;
  const totalInquiries = inquiries.length;
  const newInquiries = inquiries.filter((i) => i.status === 'new').length;

  const statCards = [
    {
      title: 'ทรัพย์ทั้งหมด',
      value: totalListings,
      change: '+3 รายการใหม่เดือนนี้',
      icon: Building2,
      color: 'text-navy-950',
      bg: 'bg-blue-50',
    },
    {
      title: 'ทรัพย์สำหรับขาย',
      value: saleListings,
      change: 'มูลค่ารวมกว่า 120M',
      icon: Tag,
      color: 'text-gold-700',
      bg: 'bg-gold-50',
    },
    {
      title: 'ทรัพย์สำหรับเช่า',
      value: rentListings,
      change: 'อัตราเช่าสำเร็จ 95%',
      icon: Key,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      title: 'ยอดผู้ติดต่อทั้งหมด',
      value: totalInquiries,
      change: `${newInquiries} รายการรอติดต่อกลับ`,
      icon: MessageSquare,
      color: 'text-purple-700',
      bg: 'bg-purple-50',
    },
  ];

  // Demo trend data for visualizations
  const trendMonths = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.'];
  const listingData = [12, 15, 18, 22, 28, 32];
  const inquiryData = [8, 14, 19, 25, 34, 42];

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {/* Welcome Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-surface-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-gold-600 uppercase tracking-widest">
            CHANTAKORN PROPERTY CONTROL CENTER
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 mt-1">
            แดชบอร์ดจัดการระบบ
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            ภาพรวมสถิติทรัพย์ ผู้ติดต่อ และสถานะการดำเนินงานในเขตหาดใหญ่–สงขลา
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/admin/properties/new"
            className="px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-gold-400" />
            <span>ลงประกาศทรัพย์ใหม่</span>
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500">{c.title}</span>
                <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className={`text-3xl font-extrabold ${c.color}`}>
                  {c.value}
                </div>
                <div className="text-[11px] text-gray-500 mt-1 flex items-center font-medium">
                  <TrendingUp className="w-3 h-3 text-emerald-600 mr-1" />
                  <span>{c.change}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Trend Charts (CSS Bar Chart Visuals) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Listings Growth Over Time */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-navy-950 text-base">การเติบโตของรายการทรัพย์ (Listings)</h3>
              <p className="text-xs text-gray-500">จำนวนอสังหาริมทรัพย์ที่รับฝากและเปิดขายในระบบ 6 เดือนย้อนหลัง</p>
            </div>
            <span className="text-xs font-bold text-gold-600 bg-gold-50 px-2.5 py-1 rounded-md">
              +166% Growth
            </span>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-4 px-2">
            {listingData.map((val, idx) => {
              const heightPercent = (val / 40) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center group">
                  <span className="text-[10px] font-bold text-navy-950 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-navy-900 group-hover:bg-gold-500 rounded-t-lg transition-all duration-300 shadow-sm"
                  />
                  <span className="text-[11px] text-gray-500 font-semibold mt-2">
                    {trendMonths[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Inquiries Over Time */}
        <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-navy-950 text-base">ยอดผู้ติดต่อ & ฝากขาย (Inquiries)</h3>
              <p className="text-xs text-gray-500">จำนวนข้อความสอบถามและนัดชมทรัพย์ 6 เดือนย้อนหลัง</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              +425% Leads
            </span>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-4 px-2">
            {inquiryData.map((val, idx) => {
              const heightPercent = (val / 50) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center group">
                  <span className="text-[10px] font-bold text-navy-950 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-gold-500 group-hover:bg-gold-600 rounded-t-lg transition-all duration-300 shadow-sm"
                  />
                  <span className="text-[11px] text-gray-500 font-semibold mt-2">
                    {trendMonths[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Inquiries Preview Table */}
      <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-navy-950 text-base">รายการผู้ติดต่อล่าสุด</h3>
            <p className="text-xs text-gray-500">ข้อความจากลูกค้าผู้สนใจซื้อ เช่า หรือฝากขายทรัพย์</p>
          </div>
          <Link
            href="/admin/inquiries"
            className="text-xs font-bold text-navy-950 hover:text-gold-600 flex items-center space-x-1"
          >
            <span>ดูทั้งหมด ({inquiries.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-semibold">ชื่อผู้ติดต่อ</th>
                <th className="pb-3 font-semibold">เบอร์โทร / LINE</th>
                <th className="pb-3 font-semibold">ประเภท</th>
                <th className="pb-3 font-semibold">ข้อความ</th>
                <th className="pb-3 font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inquiries.slice(0, 5).map((inq) => (
                <tr key={inq.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 font-bold text-navy-950">{inq.name}</td>
                  <td className="py-3 text-gray-600">
                    <div>{inq.phone}</div>
                    {inq.line_id && <div className="text-[10px] text-emerald-600 font-semibold">LINE: {inq.line_id}</div>}
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">
                      {inq.inquiry_type === 'viewing' ? 'นัดชมทรัพย์' : inq.inquiry_type === 'consignment_sell' ? 'ฝากขายทรัพย์' : 'สอบถามข้อมูล'}
                    </span>
                  </td>
                  <td className="py-3 text-gray-600 max-w-xs truncate">{inq.message}</td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      inq.status === 'new' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {inq.status === 'new' ? 'รอดำเนินการ' : 'ติดต่อแล้ว'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
