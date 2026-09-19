'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { propertyHref } from '@/components/properties/property-link';
import Image from 'next/image';
import { 
  PlusCircle, 
  Search, 
  Trash2, 
  Edit3, 
  Eye, 
  Star, 
  Filter, 
  Check, 
  AlertCircle,
  Download
} from 'lucide-react';
import { fetchAdminProperties, deleteProperty, updateProperty } from '@/lib/store/properties-store';
import { Property } from '@/lib/types';
import { formatPrice, getPropertyTypeName, formatThaiDate } from '@/lib/utils';

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sale' | 'rent'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProperties();
      setProperties(data);
    } catch (err) { setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleFeatured = async (prop: Property) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await updateProperty(prop.id, { featured: !prop.featured }); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await deleteProperty(id); setDeleteConfirmId(null); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : 'ลบรายการไม่สำเร็จ'); setDeleteConfirmId(null); }
    finally { setBusy(false); }
  };

  const filteredProperties = properties.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.district.toLowerCase().includes(q);
    }
    return true;
  });

  const handleExportCSV = () => {
    if (filteredProperties.length === 0) return;

    const headers = [
      'ID',
      'ชื่อทรัพย์ (Title)',
      'ประเภท (Type)',
      'สถานะ (Status)',
      'ราคา (Price)',
      'จังหวัด (Province)',
      'อำเภอ/เขต (District)',
      'ตำบล/แขวง (Subdistrict)',
      'ที่อยู่ (Address)',
      'ห้องนอน (Bedrooms)',
      'ห้องน้ำ (Bathrooms)',
      'ที่จอดรถ (Parking)',
      'ขนาดที่ดิน ตร.ว. (Land Size)',
      'พื้นที่ใช้สอย ตร.ม. (Usable Area)',
      'ทรัพย์เด่น (Featured)',
      'สถานะการเผยแพร่ (Published)',
      'วันที่ลงประกาศ (Created At)',
      'ลิงก์ (Slug)'
    ];

    const escapeCSV = (value: unknown) => {
      if (value === null || value === undefined) return '""';
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    };

    const rows = filteredProperties.map((p) => [
      escapeCSV(p.id),
      escapeCSV(p.title),
      escapeCSV(getPropertyTypeName(p.property_type)),
      escapeCSV(p.status === 'rent' ? 'เช่า (Rent)' : 'ขาย (Sale)'),
      escapeCSV(p.price),
      escapeCSV(p.province),
      escapeCSV(p.district),
      escapeCSV(p.subdistrict || ''),
      escapeCSV(p.address || ''),
      escapeCSV(p.bedrooms ?? 0),
      escapeCSV(p.bathrooms ?? 0),
      escapeCSV(p.parking ?? 0),
      escapeCSV(p.land_size ?? 0),
      escapeCSV(p.usable_area ?? 0),
      escapeCSV(p.featured ? 'ใช่ (Yes)' : 'ไม่ใช่ (No)'),
      escapeCSV(p.published !== false ? 'เผยแพร่ (Published)' : 'แบบร่าง (Draft)'),
      escapeCSV(p.created_at || ''),
      escapeCSV(p.slug || '')
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map((row) => row.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `properties-export-${statusFilter}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {/* Header with Add & Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-surface-border shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">จัดการอสังหาริมทรัพย์</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            จัดการรายการทรัพย์ที่เปิดขายและให้เช่าทั้งหมดในระบบ ({properties.length} รายการ)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            id="export-csv-btn"
            type="button"
            onClick={handleExportCSV}
            disabled={filteredProperties.length === 0}
            title="ดาวน์โหลดรายการทรัพย์ที่กรองแล้วเป็นไฟล์ CSV"
            className="px-4 py-2.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-navy-950 border border-gray-300 font-semibold text-xs rounded-xl shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 text-navy-700" />
            <span>Export to CSV ({filteredProperties.length})</span>
          </button>

          <Link
            id="add-new-property-btn"
            href="/admin/properties/new"
            className="px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all"
          >
            <PlusCircle className="w-4 h-4 text-gold-400" />
            <span>เพิ่มทรัพย์ใหม่</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="ค้นหาชื่อทรัพย์ หรือทำเล..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'all' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            ทั้งหมด ({properties.length})
          </button>
          <button
            onClick={() => setStatusFilter('sale')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'sale' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            สำหรับขาย ({properties.filter((p) => p.status === 'sale').length})
          </button>
          <button
            onClick={() => setStatusFilter('rent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'rent' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            สำหรับเช่า ({properties.filter((p) => p.status === 'rent').length})
          </button>
        </div>
      </div>

      {/* Property Table */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <th className="p-4 font-semibold">ภาพ</th>
                <th className="p-4 font-semibold">ชื่อทรัพย์ & รหัส</th>
                <th className="p-4 font-semibold">ประเภท</th>
                <th className="p-4 font-semibold">ราคา</th>
                <th className="p-4 font-semibold">ทำเล</th>
                <th className="p-4 font-semibold">สถานะ</th>
                <th className="p-4 font-semibold text-center">ทรัพย์เด่น</th>
                <th className="p-4 font-semibold">วันที่ลง</th>
                <th className="p-4 font-semibold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    ไม่พบข้อมูลอสังหาริมทรัพย์
                  </td>
                </tr>
              ) : (
                filteredProperties.map((prop) => (
                  <tr key={prop.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4">
                      <div className="relative w-14 h-11 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                        <Image
                          src={prop.cover_image}
                          alt={prop.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </td>
                    <td className="p-4 max-w-xs">
                      <Link
                        href={propertyHref(prop.slug)}
                        target="_blank"
                        className="font-bold text-navy-950 hover:text-gold-600 line-clamp-1"
                      >
                        {prop.title}
                      </Link>
                      <span className="text-[10px] text-gray-400 block font-mono">
                        {prop.id}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700">
                      {getPropertyTypeName(prop.property_type)}
                    </td>
                    <td className="p-4 font-bold text-navy-950">
                      {formatPrice(prop.price, prop.status)}
                    </td>
                    <td className="p-4 text-gray-600">
                      {prop.district}, {prop.province}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        prop.status === 'rent' ? 'bg-emerald-100 text-emerald-800' : 'bg-gold-100 text-gold-900'
                      }`}>
                        {prop.status === 'rent' ? 'เช่า' : 'ขาย'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        disabled={busy} onClick={() => handleToggleFeatured(prop)}
                        title="คลิกเพื่อสลับสถานะทรัพย์เด่น"
                        className="p-1 text-gray-400 hover:text-gold-500 transition-colors"
                      >
                        <Star className={`w-4 h-4 ${prop.featured ? 'fill-gold-500 text-gold-500' : ''}`} />
                      </button>
                    </td>
                    <td className="p-4 text-gray-500 text-[11px]">
                      {formatThaiDate(prop.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Link
                          href={propertyHref(prop.slug)}
                          target="_blank"
                          className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg"
                          title="ดูบนเว็บไซต์"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link href={'/admin/properties/new?id=' + encodeURIComponent(prop.id)} title="แก้ไขรายการ" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"><Edit3 className="w-4 h-4" /></Link>
                        <button
                          disabled={busy}
                          onClick={() => setDeleteConfirmId(prop.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          title="ลบรายการนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-surface-border text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-navy-950 text-base">ต้องการลบอสังหาริมทรัพย์นี้?</h3>
            <p className="text-xs text-gray-500">
              การลบรายการนี้จะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?
            </p>
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                disabled={busy} onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
