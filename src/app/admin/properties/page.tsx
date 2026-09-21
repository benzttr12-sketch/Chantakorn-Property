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
  Download,
  Copy,
  CheckCircle2,
  Globe,
  Building,
  Home,
  Layers,
  MapPin
} from 'lucide-react';
import { fetchAdminProperties, deleteProperty, updateProperty } from '@/lib/store/properties-store';
import { Property } from '@/lib/types';
import { formatPrice, getPropertyTypeName, formatThaiDate } from '@/lib/utils';
import { DISTRICTS_LIST } from '@/data/locations';

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sale' | 'rent'>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const handleTogglePublished = async (prop: Property) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await updateProperty(prop.id, { published: !prop.published }); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : 'บันทึกสถานะไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  const handleCopyLink = (prop: Property) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}${propertyHref(prop.slug)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl);
      setCopiedId(prop.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
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
    if (districtFilter !== 'all' && p.district !== districtFilter) return false;
    if (typeFilter !== 'all' && p.property_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) || 
        p.district.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
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
      
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-950 flex items-center justify-center font-bold flex-shrink-0">
            <Layers className="w-5 h-5 text-navy-800" />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 font-medium">ทรัพย์ทั้งหมด</div>
            <div className="text-lg font-black text-navy-950">{properties.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gold-50 text-gold-700 flex items-center justify-center font-bold flex-shrink-0">
            <Home className="w-5 h-5 text-gold-600" />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 font-medium">เปิดขาย</div>
            <div className="text-lg font-black text-navy-950">
              {properties.filter((p) => p.status === 'sale').length}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
            <Building className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 font-medium">ปล่อยเช่า</div>
            <div className="text-lg font-black text-navy-950">
              {properties.filter((p) => p.status === 'rent').length}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold flex-shrink-0">
            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 font-medium">ทรัพย์เด่น</div>
            <div className="text-lg font-black text-navy-950">
              {properties.filter((p) => p.featured).length}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs col-span-2 sm:col-span-1 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-[11px] text-gray-500 font-medium">เผยแพร่อยู่</div>
            <div className="text-lg font-black text-navy-950">
              {properties.filter((p) => p.published !== false).length}
            </div>
          </div>
        </div>
      </div>

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
            className="px-4 py-2.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-navy-950 border border-gray-300 font-semibold text-xs rounded-xl shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4 text-navy-700" />
            <span>Export CSV ({filteredProperties.length})</span>
          </button>

          <Link
            id="add-new-property-btn"
            href="/admin/properties/new"
            className="px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-gold-400" />
            <span>+ เพิ่มทรัพย์ใหม่</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="ค้นหาชื่อทรัพย์, อำเภอ หรือรหัส ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-navy-950 text-gold-400 shadow-xs' : 'text-gray-600 hover:text-navy-950'
                }`}
              >
                ทั้งหมด ({properties.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('sale')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === 'sale' ? 'bg-navy-950 text-gold-400 shadow-xs' : 'text-gray-600 hover:text-navy-950'
                }`}
              >
                ขาย ({properties.filter((p) => p.status === 'sale').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('rent')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === 'rent' ? 'bg-navy-950 text-gold-400 shadow-xs' : 'text-gray-600 hover:text-navy-950'
                }`}
              >
                เช่า ({properties.filter((p) => p.status === 'rent').length})
              </button>
            </div>

            {/* District Filter Dropdown */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-navy-950 font-medium focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer"
            >
              <option value="all">📍 ทุกอำเภอในสงขลา</option>
              {DISTRICTS_LIST.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>

            {/* Property Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-navy-950 font-medium focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer"
            >
              <option value="all">🏢 ทุกประเภทอสังหาฯ</option>
              <option value="house">บ้าน / ทาวน์โฮม</option>
              <option value="land">ที่ดิน</option>
              <option value="condo">คอนโดมิเนียม</option>
              <option value="commercial">อาคารพาณิชย์</option>
              <option value="investment">เพื่อการลงทุน</option>
              <option value="consignment">ขายฝาก / จำนอง</option>
            </select>

            {(districtFilter !== 'all' || typeFilter !== 'all' || searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setDistrictFilter('all');
                  setTypeFilter('all');
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="text-xs text-red-600 hover:underline font-bold px-2 py-1"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Card View (For screens < md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-200">
            กำลังโหลดข้อมูล...
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-200">
            ไม่พบข้อมูลอสังหาริมทรัพย์ที่ค้นหา
          </div>
        ) : (
          filteredProperties.map((prop) => (
            <div key={prop.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
              <div className="flex gap-3">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                  <Image
                    src={prop.cover_image}
                    alt={prop.title}
                    fill
                    unoptimized
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                  <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    prop.status === 'rent' ? 'bg-emerald-600 text-white' : 'bg-gold-500 text-navy-950'
                  }`}>
                    {prop.status === 'rent' ? 'เช่า' : 'ขาย'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <Link
                      href={propertyHref(prop.slug)}
                      target="_blank"
                      className="font-bold text-navy-950 hover:text-gold-600 line-clamp-2 text-xs leading-snug"
                    >
                      {prop.title}
                    </Link>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleFeatured(prop)}
                      className="p-1 text-gray-300 hover:text-amber-500 flex-shrink-0"
                    >
                      <Star className={`w-4 h-4 ${prop.featured ? 'fill-amber-400 text-amber-500' : ''}`} />
                    </button>
                  </div>

                  <div className="text-sm font-extrabold text-navy-950 mt-1">
                    {formatPrice(prop.price, prop.status)}
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center mt-0.5">
                    <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                    {prop.district}, {prop.province}
                  </div>
                </div>
              </div>

              {/* Bottom Action Strip on Mobile */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleTogglePublished(prop)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 ${
                    prop.published !== false
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>{prop.published !== false ? 'เผยแพร่แล้ว' : 'แบบร่าง'}</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(prop)}
                    className="p-1.5 text-navy-700 hover:bg-gray-100 rounded-lg text-[11px] flex items-center space-x-1 border border-gray-200"
                    title="คัดลอกลิงก์ส่งต่อลูกค้า"
                  >
                    {copiedId === prop.id ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold text-[10px]">คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-[10px]">แชร์</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={propertyHref(prop.slug)}
                    target="_blank"
                    className="p-1.5 text-gray-600 hover:text-navy-950 hover:bg-gray-100 rounded-lg border border-gray-200"
                    title="ดูหน้าเว็บ"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href={'/admin/properties/new?id=' + encodeURIComponent(prop.id)}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
                    title="แก้ไข"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleteConfirmId(prop.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-100"
                    title="ลบ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Property Table (For screens >= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
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
                <th className="p-4 font-semibold text-center">เผยแพร่</th>
                <th className="p-4 font-semibold text-center">ทรัพย์เด่น</th>
                <th className="p-4 font-semibold">วันที่ลง</th>
                <th className="p-4 font-semibold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    ไม่พบข้อมูลอสังหาริมทรัพย์ที่ค้นหา
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
                          unoptimized
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                      </div>
                    </td>
                    <td className="p-4 max-w-xs">
                      <Link
                        href={propertyHref(prop.slug)}
                        target="_blank"
                        className="font-bold text-navy-950 hover:text-gold-600 line-clamp-1 text-xs"
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
                        type="button"
                        disabled={busy}
                        onClick={() => handleTogglePublished(prop)}
                        title="คลิกเพื่อสลับการเผยแพร่/แบบร่าง"
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                          prop.published !== false
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {prop.published !== false ? 'ออนไลน์' : 'แบบร่าง'}
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleFeatured(prop)}
                        title="คลิกเพื่อสลับสถานะทรัพย์เด่น"
                        className="p-1 text-gray-400 hover:text-amber-500 transition-colors cursor-pointer"
                      >
                        <Star className={`w-4 h-4 ${prop.featured ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </td>
                    <td className="p-4 text-gray-500 text-[11px]">
                      {formatThaiDate(prop.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(prop)}
                          className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg cursor-pointer"
                          title="คัดลอกลิงก์ส่งต่อลูกค้า"
                        >
                          {copiedId === prop.id ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <Link
                          href={propertyHref(prop.slug)}
                          target="_blank"
                          className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg cursor-pointer"
                          title="ดูบนเว็บไซต์"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link 
                          href={'/admin/properties/new?id=' + encodeURIComponent(prop.id)} 
                          title="แก้ไขรายการ" 
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleteConfirmId(prop.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
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
