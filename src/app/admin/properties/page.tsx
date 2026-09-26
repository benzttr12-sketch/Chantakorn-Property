'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Building2, 
  PlusCircle, 
  Search, 
  Trash2, 
  Edit3, 
  Eye, 
  Star, 
  Copy, 
  CheckCircle2, 
  Globe, 
  AlertCircle,
  Download,
  Layers,
  Home,
  Building,
  MapPin,
  CopyPlus,
  CheckSquare,
  Square,
  ArrowUpDown,
  Check,
  RotateCcw,
  Sparkles,
  Zap,
  Wand2,
  X,
  ChevronDown,
  Loader2,
  Tag,
  History
} from 'lucide-react';
import QuickPropertyModal from '@/components/admin/QuickPropertyModal';
import PropertyHistoryModal from '@/components/admin/PropertyHistoryModal';
import AdminLandsMapsOverlayModal from '@/components/admin/AdminLandsMapsOverlayModal';
import { 
  fetchAdminProperties, 
  updateProperty, 
  deleteProperty,
  createProperty 
} from '@/lib/store/properties-store';
import { Property, PropertyStatus, PropertyType } from '@/lib/types';
import { 
  formatPrice, 
  propertyHref, 
  formatThaiDate, 
  getPropertyTypeName,
  formatPropertyCode,
  DISTRICTS_LIST 
} from '@/lib/utils';

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sale' | 'rent' | 'featured' | 'draft' | 'published'>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price_desc' | 'price_asc' | 'area_desc'>('newest');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicateSuccessMessage, setDuplicateSuccessMessage] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [quickModalOpen, setQuickModalOpen] = useState(false);

  // Property History Modal State
  const [historyModalProperty, setHistoryModalProperty] = useState<Property | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // DOL LandsMaps Overlay Modal State
  const [landsMapsModalProperty, setLandsMapsModalProperty] = useState<Property | null>(null);
  const [isLandsMapsModalOpen, setIsLandsMapsModalOpen] = useState(false);

  const handleOpenHistory = (prop: Property) => {
    setHistoryModalProperty(prop);
    setIsHistoryModalOpen(true);
  };

  const handleOpenLandsMapsOverlay = (prop: Property) => {
    setLandsMapsModalProperty(prop);
    setIsLandsMapsModalOpen(true);
  };

  // Inline Edit State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState<string>('');
  const [inlineUpdatingId, setInlineUpdatingId] = useState<string | null>(null);
  const [inlineSuccessToast, setInlineSuccessToast] = useState<{ id: string; message: string } | null>(null);
  const [activeStatusDropdownId, setActiveStatusDropdownId] = useState<string | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  const handleStartEditPrice = (prop: Property) => {
    setEditingPriceId(prop.id);
    setInlinePriceInput(String(prop.price || ''));
  };

  const handleCancelEditPrice = () => {
    setEditingPriceId(null);
    setInlinePriceInput('');
  };

  const handleSaveInlinePrice = async (propId: string) => {
    const rawClean = inlinePriceInput.replace(/,/g, '').trim();
    const numPrice = parseFloat(rawClean);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('กรุณาระบุตัวเลขราคาที่ถูกต้อง');
      return;
    }

    setInlineUpdatingId(propId);
    setError('');
    try {
      await updateProperty(propId, { price: numPrice });
      setEditingPriceId(null);
      setInlinePriceInput('');
      setHighlightedRowId(propId);
      setTimeout(() => setHighlightedRowId(null), 3500);
      setInlineSuccessToast({ id: propId, message: 'บันทึกราคาใหม่สำเร็จ' });
      setTimeout(() => setInlineSuccessToast(null), 3000);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกราคาได้');
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const handleInlineUpdateStatus = async (propId: string, newStatus: PropertyStatus) => {
    setInlineUpdatingId(propId);
    setActiveStatusDropdownId(null);
    setError('');
    try {
      await updateProperty(propId, { status: newStatus });
      setHighlightedRowId(propId);
      setTimeout(() => setHighlightedRowId(null), 3500);
      setInlineSuccessToast({ 
        id: propId, 
        message: `เปลี่ยนสถานะเป็น "${newStatus === 'rent' ? 'เช่า' : 'ขาย'}" เรียบร้อยแล้ว` 
      });
      setTimeout(() => setInlineSuccessToast(null), 3000);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนสถานะได้');
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminProperties();
      setProperties(data);
    } catch (err) { 
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close active status dropdown on outside click
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.inline-status-dropdown-container')) {
        setActiveStatusDropdownId(null);
      }
    };
    if (activeStatusDropdownId) {
      document.addEventListener('click', handleDocumentClick);
    }
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [activeStatusDropdownId]);

  const handleToggleFeatured = async (prop: Property) => {
    if (busy) return;
    setBusy(true); setError('');
    try { 
      await updateProperty(prop.id, { featured: !prop.featured }); 
      await loadData(); 
    } catch (err) { 
      setError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ'); 
    } finally { 
      setBusy(false); 
    }
  };

  const handleTogglePublished = async (prop: Property) => {
    if (busy) return;
    setBusy(true); setError('');
    try { 
      await updateProperty(prop.id, { published: !prop.published }); 
      await loadData(); 
    } catch (err) { 
      setError(err instanceof Error ? err.message : 'บันทึกสถานะไม่สำเร็จ'); 
    } finally { 
      setBusy(false); 
    }
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

  const handleCopyCode = (id: string) => {
    const code = formatPropertyCode(id);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    }
  };

  const handleDuplicate = async (prop: Property) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const newSlug = `${prop.slug || 'property'}-copy-${randomSuffix}`;
      const duplicated: Property = {
        ...prop,
        id: crypto.randomUUID(),
        title: `(คัดลอก) ${prop.title}`,
        slug: newSlug,
        published: false, // Start as draft so agent can review/edit
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await createProperty(duplicated);
      setDuplicateSuccessMessage(`คัดลอก "${prop.title}" เรียบร้อยแล้ว (บันทึกเป็นแบบร่าง)`);
      setTimeout(() => setDuplicateSuccessMessage(null), 4000);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถคัดลอกทรัพย์ได้');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try { 
      await deleteProperty(id); 
      setDeleteConfirmId(null); 
      setSelectedIds(prev => prev.filter(item => item !== id));
      await loadData(); 
    } catch (err) { 
      setError(err instanceof Error ? err.message : 'ลบรายการไม่สำเร็จ'); 
      setDeleteConfirmId(null); 
    } finally { 
      setBusy(false); 
    }
  };

  // Bulk Actions Handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredProperties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProperties.map(p => p.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkPublish = async (publishStatus: boolean) => {
    if (selectedIds.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedIds.map(id => updateProperty(id, { published: publishStatus })));
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถแก้ไขสถานะรายการที่เลือกได้');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedIds.map(id => deleteProperty(id)));
      setSelectedIds([]);
      setBulkConfirmDelete(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถลบรายการที่เลือกได้');
    } finally {
      setBusy(false);
    }
  };

  const filteredProperties = properties.filter((p) => {
    if (statusFilter === 'sale' && p.status !== 'sale') return false;
    if (statusFilter === 'rent' && p.status !== 'rent') return false;
    if (statusFilter === 'featured' && !p.featured) return false;
    if (statusFilter === 'draft' && p.published !== false) return false;
    if (statusFilter === 'published' && p.published === false) return false;
    if (districtFilter !== 'all' && p.district !== districtFilter) return false;
    if (typeFilter !== 'all' && p.property_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) || 
        p.district.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        formatPropertyCode(p.id).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedProperties = [...filteredProperties].sort((a, b) => {
    if (sortBy === 'newest') {
      return (b.created_at || '').localeCompare(a.created_at || '');
    }
    if (sortBy === 'oldest') {
      return (a.created_at || '').localeCompare(b.created_at || '');
    }
    if (sortBy === 'price_desc') {
      return (b.price || 0) - (a.price || 0);
    }
    if (sortBy === 'price_asc') {
      return (a.price || 0) - (b.price || 0);
    }
    if (sortBy === 'area_desc') {
      return (b.usable_area || 0) - (a.usable_area || 0);
    }
    return 0;
  });

  const handleExportCSV = () => {
    if (filteredProperties.length === 0) return;

    const headers = [
      'ID',
      'รหัสทรัพย์ (Code)',
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

    const rows = sortedProperties.map((p) => [
      escapeCSV(p.id),
      escapeCSV(formatPropertyCode(p.id)),
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
    link.setAttribute('href', url);
    link.setAttribute('download', `chantakorn_properties_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-24">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-200">
          {error}
        </p>
      )}

      {duplicateSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{duplicateSuccessMessage}</span>
          </div>
          <button 
            onClick={() => setDuplicateSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all' 
              ? 'bg-navy-950 text-white border-navy-900 shadow-md ring-2 ring-gold-400/40' 
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              statusFilter === 'all' ? 'bg-navy-900 text-gold-400' : 'bg-navy-50 text-navy-800'
            }`}>
              <Layers className="w-4 h-4" />
            </div>
            <div className={`text-[11px] font-medium ${statusFilter === 'all' ? 'text-gray-300' : 'text-gray-500'}`}>
              ทั้งหมด
            </div>
          </div>
          <div className="text-xl font-black">{properties.length}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('sale')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'sale' 
              ? 'bg-gold-500 text-navy-950 border-gold-600 shadow-md ring-2 ring-navy-950/20' 
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              statusFilter === 'sale' ? 'bg-gold-600 text-navy-950' : 'bg-gold-50 text-gold-700'
            }`}>
              <Home className="w-4 h-4" />
            </div>
            <div className={`text-[11px] font-medium ${statusFilter === 'sale' ? 'text-navy-900 font-bold' : 'text-gray-500'}`}>
              เปิดขาย
            </div>
          </div>
          <div className="text-xl font-black">
            {properties.filter((p) => p.status === 'sale').length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('rent')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'rent' 
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40' 
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              statusFilter === 'rent' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700'
            }`}>
              <Building className="w-4 h-4" />
            </div>
            <div className={`text-[11px] font-medium ${statusFilter === 'rent' ? 'text-emerald-100' : 'text-gray-500'}`}>
              ปล่อยเช่า
            </div>
          </div>
          <div className="text-xl font-black">
            {properties.filter((p) => p.status === 'rent').length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('featured')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'featured' 
              ? 'bg-amber-500 text-navy-950 border-amber-600 shadow-md ring-2 ring-amber-300' 
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              statusFilter === 'featured' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'
            }`}>
              <Star className="w-4 h-4 fill-current" />
            </div>
            <div className={`text-[11px] font-medium ${statusFilter === 'featured' ? 'text-navy-950 font-bold' : 'text-gray-500'}`}>
              ทรัพย์เด่น
            </div>
          </div>
          <div className="text-xl font-black">
            {properties.filter((p) => p.featured).length}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('draft')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            statusFilter === 'draft' 
              ? 'bg-gray-800 text-white border-gray-900 shadow-md' 
              : 'bg-white text-navy-950 border-surface-border shadow-xs hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              statusFilter === 'draft' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              <Globe className="w-4 h-4" />
            </div>
            <div className={`text-[11px] font-medium ${statusFilter === 'draft' ? 'text-gray-300' : 'text-gray-500'}`}>
              แบบร่าง
            </div>
          </div>
          <div className="text-xl font-black">
            {properties.filter((p) => p.published === false).length}
          </div>
        </button>
      </div>

      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-surface-border shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950">จัดการอสังหาริมทรัพย์</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            ค้นหา คัดลอก แก้ไข และเผยแพร่ทรัพย์ในเขตหาดใหญ่–สงขลา ({filteredProperties.length} จาก {properties.length} รายการ)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition-colors cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="export-csv-btn"
            type="button"
            onClick={handleExportCSV}
            disabled={filteredProperties.length === 0}
            title="ดาวน์โหลดรายการทรัพย์ที่กรองแล้วเป็นไฟล์ CSV"
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-navy-950 border border-gray-300 font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-navy-700" />
            <span>Export CSV</span>
          </button>

          <Link
            href="/admin/automation"
            className="px-3.5 py-2 bg-gradient-to-r from-navy-950 to-blue-900 hover:from-navy-900 hover:to-blue-800 text-gold-300 border border-gold-500/30 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
            title="เข้าสู่ศูนย์ระบบอัตโนมัติ AI (สร้างโพสต์/จับคู่ลูกค้า/ร่างสัญญา/วิเคราะห์ Yield)"
          >
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span>ระบบอัตโนมัติ AI</span>
          </Link>

          <button
            type="button"
            onClick={() => setQuickModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-400 hover:to-gold-400 text-navy-950 font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95 border border-gold-300"
            title="วางข้อความจาก LINE หรือ Facebook เพื่อลงทรัพย์ได้ทันที 1-Click"
          >
            <Zap className="w-4 h-4 text-navy-950 fill-navy-950" />
            <span>⚡ ลงทรัพย์ด่วน 1-Click</span>
          </button>

          <Link
            id="add-new-property-btn"
            href="/admin/properties/new"
            className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-gold-400" />
            <span>+ ฟอร์มเต็ม</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="ค้นหาชื่อทรัพย์, อำเภอ หรือรหัส เช่น CK-01..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-500 font-medium"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Selectors & Sort */}
          <div className="flex flex-wrap items-center gap-2">
            {/* District Dropdown */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-navy-950 font-medium focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer"
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
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-navy-950 font-medium focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer"
            >
              <option value="all">🏢 ทุกประเภทอสังหาฯ</option>
              <option value="house">บ้าน / ทาวน์โฮม</option>
              <option value="land">ที่ดิน</option>
              <option value="condo">คอนโดมิเนียม</option>
              <option value="commercial">อาคารพาณิชย์</option>
              <option value="investment">เพื่อการลงทุน</option>
              <option value="consignment">ขายฝาก / จำนอง</option>
            </select>

            {/* Sort Selector */}
            <div className="flex items-center space-x-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-navy-950 font-semibold focus:outline-none cursor-pointer py-1 pr-1"
              >
                <option value="newest">ล่าสุด ➔ เก่าสุด</option>
                <option value="oldest">เก่าสุด ➔ ล่าสุด</option>
                <option value="price_desc">ราคา: สูง ➔ ต่ำ</option>
                <option value="price_asc">ราคา: ต่ำ ➔ สูง</option>
                <option value="area_desc">พื้นที่: มาก ➔ น้อย</option>
              </select>
            </div>

            {(districtFilter !== 'all' || typeFilter !== 'all' || searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setDistrictFilter('all');
                  setTypeFilter('all');
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="text-xs text-red-600 hover:text-red-700 font-bold px-2 py-1.5 hover:underline cursor-pointer"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Status Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
          <span className="text-[11px] font-bold text-gray-400 mr-1">สถานะ:</span>
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'sale', label: '🏷️ ขาย' },
            { id: 'rent', label: '🔑 เช่า' },
            { id: 'featured', label: '🌟 ทรัพย์เด่น' },
            { id: 'published', label: '🌐 เผยแพร่อยู่' },
            { id: 'draft', label: '📝 แบบร่าง' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-navy-950 text-gold-400 shadow-xs'
                  : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-navy-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card View (Screens < md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-200">
            กำลังโหลดข้อมูล...
          </div>
        ) : sortedProperties.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-200">
            ไม่พบข้อมูลอสังหาริมทรัพย์ที่ค้นหา
          </div>
        ) : (
          sortedProperties.map((prop) => {
            const isHighlighted = highlightedRowId === prop.id;
            const isSelected = selectedIds.includes(prop.id);
            return (
              <div 
                key={prop.id} 
                className={`rounded-2xl border p-4 shadow-xs space-y-3 transition-all duration-700 ease-in-out ${
                  isHighlighted 
                    ? 'border-gold-500 bg-amber-50/90 ring-2 ring-gold-400 shadow-md animate-pulse' 
                    : isSelected 
                      ? 'border-gold-500 bg-gold-50/20' 
                      : 'bg-white border-gray-200'
                }`}
              >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleSelect(prop.id)}
                  className="mt-1 text-gray-400 hover:text-navy-950"
                >
                  {selectedIds.includes(prop.id) ? (
                    <CheckSquare className="w-5 h-5 text-gold-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                </button>

                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                  <Image
                    src={prop.cover_image}
                    alt={prop.title}
                    fill
                    unoptimized
                    referrerPolicy="no-referrer"
                    className="object-cover"
                  />
                  <div className="absolute top-1 left-1 inline-status-dropdown-container">
                    <button
                      type="button"
                      onClick={() => setActiveStatusDropdownId(activeStatusDropdownId === `m-${prop.id}` ? null : `m-${prop.id}`)}
                      disabled={inlineUpdatingId === prop.id}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold shadow-xs flex items-center gap-0.5 cursor-pointer border ${
                        prop.status === 'rent' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-gold-500 text-navy-950 border-gold-600'
                      }`}
                      title="แตะเพื่อสลับสถานะ ขาย/เช่า"
                    >
                      {inlineUpdatingId === prop.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <span>{prop.status === 'rent' ? 'เช่า' : 'ขาย'}</span>
                      )}
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                    {activeStatusDropdownId === `m-${prop.id}` && (
                      <div className="absolute top-full left-0 mt-1 z-30 w-28 bg-white rounded-lg shadow-xl border border-gray-200 py-1 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleInlineUpdateStatus(prop.id, 'sale')}
                          className={`w-full px-2 py-1 text-left text-[11px] font-bold flex items-center justify-between ${
                            prop.status === 'sale' ? 'bg-gold-50 text-navy-950' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>🏷️ ขาย</span>
                          {prop.status === 'sale' && <Check className="w-3 h-3 text-gold-600" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInlineUpdateStatus(prop.id, 'rent')}
                          className={`w-full px-2 py-1 text-left text-[11px] font-bold flex items-center justify-between ${
                            prop.status === 'rent' ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>🔑 เช่า</span>
                          {prop.status === 'rent' && <Check className="w-3 h-3 text-emerald-600" />}
                        </button>
                      </div>
                    )}
                  </div>
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

                  {/* Inline Price on Mobile */}
                  {editingPriceId === prop.id ? (
                    <div className="mt-1 p-2 bg-amber-50/90 border border-gold-400 rounded-xl shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-navy-950">
                        <span>แก้ไขราคาด่วน</span>
                        <button
                          type="button"
                          onClick={handleCancelEditPrice}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-gray-500 font-bold text-xs">฿</span>
                        <input
                          type="text"
                          autoFocus
                          value={inlinePriceInput}
                          onChange={(e) => setInlinePriceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlinePrice(prop.id);
                            if (e.key === 'Escape') handleCancelEditPrice();
                          }}
                          disabled={inlineUpdatingId === prop.id}
                          className="w-full pl-5 pr-2 py-1 text-xs font-bold text-navy-950 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gold-500"
                          placeholder="ระบุราคา..."
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                            setInlinePriceInput(String(cur + 100000));
                          }}
                          className="px-1.5 py-0.5 text-[9px] bg-white text-gray-700 rounded border border-gray-200"
                        >
                          +100k
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                            setInlinePriceInput(String(cur + 500000));
                          }}
                          className="px-1.5 py-0.5 text-[9px] bg-white text-gray-700 rounded border border-gray-200"
                        >
                          +500k
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveInlinePrice(prop.id)}
                          disabled={inlineUpdatingId === prop.id}
                          className="ml-auto px-2 py-0.5 bg-navy-950 text-gold-400 text-[10px] font-bold rounded flex items-center gap-0.5 cursor-pointer"
                        >
                          {inlineUpdatingId === prop.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                          <span>บันทึก</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="text-sm font-extrabold text-navy-950">
                        {formatPrice(prop.price, prop.status)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartEditPrice(prop)}
                        className="p-1 text-gray-400 hover:text-navy-950 hover:bg-gold-50 rounded border border-transparent hover:border-gold-300"
                        title="แก้ไขราคาด่วน"
                      >
                        <Edit3 className="w-3 h-3 text-gold-600" />
                      </button>
                    </div>
                  )}

                  <div className="text-[11px] text-gray-500 flex items-center justify-between mt-0.5">
                    <span className="flex items-center truncate">
                      <MapPin className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{prop.district}</span>
                      {prop.facing_direction && (
                        <span className="ml-1.5 text-[9px] font-semibold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                          ☯ {prop.facing_direction}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(prop.id)}
                      className="font-mono text-gray-600 text-[10px] font-semibold bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1"
                      title="คลิกเพื่อคัดลอกรหัส"
                    >
                      <span>{formatPropertyCode(prop.id)}</span>
                      {copiedCodeId === prop.id && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                    </button>
                  </div>

                  {/* Agent badge on mobile */}
                  <div className="flex items-center space-x-1.5 mt-1.5 pt-1.5 border-t border-gray-100 text-[11px] text-navy-900">
                    <span className="text-gray-400 text-[10px]">ผู้ดูแล:</span>
                    <span className="truncate font-bold max-w-[130px]">{prop.agent?.name || 'Chantakorn Property'}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      prop.agent?.rank === 'แอดมิน' ? 'bg-gold-100 text-gold-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {prop.agent?.rank === 'แอดมิน' ? '🛡️ แอดมิน' : '👔 นายหน้า'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Strip on Mobile */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTogglePublished(prop)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 ${
                    prop.published !== false
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>{prop.published !== false ? 'ออนไลน์' : 'แบบร่าง'}</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(prop)}
                    className="p-1.5 text-navy-700 hover:bg-gray-100 rounded-lg text-[11px] flex items-center space-x-1 border border-gray-200"
                    title="คัดลอกลิงก์ส่งต่อลูกค้า"
                  >
                    {copiedId === prop.id ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenLandsMapsOverlay(prop)}
                    className="p-1.5 text-navy-800 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg border border-emerald-200"
                    title="ตรวจสอบระวาง & โฉนดกรมที่ดิน (DOL LandsMaps Overlay)"
                  >
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenHistory(prop)}
                    className="p-1.5 text-navy-800 hover:bg-gold-50 hover:text-gold-700 rounded-lg border border-gold-200"
                    title="ดูประวัติการแก้ไขและปรับราคา (Property History)"
                  >
                    <History className="w-3.5 h-3.5 text-gold-600" />
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDuplicate(prop)}
                    className="p-1.5 text-navy-700 hover:bg-navy-50 rounded-lg border border-gray-200"
                    title="คัดลอกเป็นทรัพย์ใหม่ (Clone)"
                  >
                    <CopyPlus className="w-3.5 h-3.5 text-navy-800" />
                  </button>

                  <Link
                    href={`/admin/automation?propertyId=${encodeURIComponent(prop.id)}`}
                    className="p-1.5 text-gold-600 hover:text-gold-700 hover:bg-gold-50 rounded-lg border border-gold-200"
                    title="ระบบอัตโนมัติ AI"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href={propertyHref(prop.slug)}
                    target="_blank"
                    className="p-1.5 text-gray-600 hover:text-navy-950 hover:bg-gray-100 rounded-lg border border-gray-200"
                    title="ดูหน้าเว็บ"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href={`/admin/properties/new?id=${encodeURIComponent(prop.id)}`}
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
          );
        })
      )}
      </div>

      {/* Desktop Property Table (Screens >= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-surface-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50/80 text-gray-600 border-b border-gray-200">
                <th className="p-3 text-center w-10">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-gray-400 hover:text-navy-950 cursor-pointer"
                    title="เลือกทั้งหมด"
                  >
                    {selectedIds.length > 0 && selectedIds.length === filteredProperties.length ? (
                      <CheckSquare className="w-4 h-4 text-gold-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3.5 font-semibold">ภาพ</th>
                <th className="p-3.5 font-semibold">ชื่อทรัพย์ & รหัส</th>
                <th className="p-3.5 font-semibold">ประเภท</th>
                <th className="p-3.5 font-semibold">ราคา</th>
                <th className="p-3.5 font-semibold">ทำเล</th>
                <th className="p-3.5 font-semibold">สถานะ</th>
                <th className="p-3.5 font-semibold">นายหน้าผู้ดูแล</th>
                <th className="p-3.5 font-semibold text-center">เผยแพร่</th>
                <th className="p-3.5 font-semibold text-center">ทรัพย์เด่น</th>
                <th className="p-3.5 font-semibold">วันที่ลง</th>
                <th className="p-3.5 font-semibold text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : sortedProperties.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-500">
                    ไม่พบข้อมูลอสังหาริมทรัพย์ที่ค้นหา
                  </td>
                </tr>
              ) : (
                sortedProperties.map((prop) => {
                  const isHighlighted = highlightedRowId === prop.id;
                  const isSelected = selectedIds.includes(prop.id);
                  return (
                    <tr 
                      key={prop.id} 
                      className={`transition-all duration-700 ease-in-out ${
                        isHighlighted
                          ? 'bg-amber-100/90 border-l-4 border-l-gold-500 shadow-sm animate-pulse'
                          : isSelected 
                            ? 'bg-gold-50/40 hover:bg-gold-50/70' 
                            : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(prop.id)}
                          className="text-gray-400 hover:text-navy-950 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-gold-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-3.5">
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
                      <td className="p-3.5 max-w-xs">
                        <Link
                          href={propertyHref(prop.slug)}
                          target="_blank"
                          className="font-bold text-navy-950 hover:text-gold-600 line-clamp-1 text-xs"
                        >
                          {prop.title}
                        </Link>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(prop.id)}
                            className="text-[10px] text-gray-600 font-mono font-medium hover:text-navy-950 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.2 rounded border border-gray-200 inline-flex items-center gap-1 cursor-pointer"
                            title="คลิกเพื่อคัดลอกรหัสทรัพย์"
                          >
                            <span>รหัส: <strong className="font-bold">{formatPropertyCode(prop.id)}</strong></span>
                            {copiedCodeId === prop.id && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                          </button>
                          {prop.facing_direction && (
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              ☯ {prop.facing_direction}
                            </span>
                          )}
                          {prop.internal_notes && (
                            <span 
                              className="text-[10px] font-bold text-amber-950 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded-md truncate max-w-[180px]"
                              title={`บันทึกภายใน: ${prop.internal_notes}`}
                            >
                              🔒 บันทึกลับ: {prop.internal_notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-gray-700 font-medium">
                        {getPropertyTypeName(prop.property_type)}
                      </td>
                      <td className="p-3.5">
                        {editingPriceId === prop.id ? (
                          <div className="relative z-20 flex flex-col gap-1.5 p-2 bg-amber-50/95 border border-gold-400 rounded-xl shadow-lg min-w-[190px]">
                            <div className="flex items-center justify-between text-[11px] font-bold text-navy-950">
                              <span className="flex items-center gap-1">
                                <Tag className="w-3 h-3 text-gold-600" />
                                <span>แก้ไขราคา</span>
                              </span>
                              <span className="text-[9px] text-gray-500 font-normal">Enter: บันทึก</span>
                            </div>

                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-gray-500 font-bold text-xs">฿</span>
                              <input
                                type="text"
                                autoFocus
                                value={inlinePriceInput}
                                onChange={(e) => setInlinePriceInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlinePrice(prop.id);
                                  if (e.key === 'Escape') handleCancelEditPrice();
                                }}
                                disabled={inlineUpdatingId === prop.id}
                                className="w-full pl-6 pr-2 py-1 text-xs font-bold text-navy-950 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 shadow-inner"
                                placeholder="ระบุราคา..."
                              />
                            </div>

                            {/* Quick adjustment pills */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                                  setInlinePriceInput(String(Math.max(0, cur - 100000)));
                                }}
                                className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer"
                              >
                                -100k
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                                  setInlinePriceInput(String(cur + 100000));
                                }}
                                className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer"
                              >
                                +100k
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = parseFloat(inlinePriceInput.replace(/,/g, '') || '0') || 0;
                                  setInlinePriceInput(String(cur + 500000));
                                }}
                                className="px-1.5 py-0.5 text-[10px] bg-white hover:bg-gray-100 text-gray-700 rounded border border-gray-200 cursor-pointer"
                              >
                                +500k
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 pt-1 border-t border-gold-200">
                              <button
                                type="button"
                                onClick={() => handleSaveInlinePrice(prop.id)}
                                disabled={inlineUpdatingId === prop.id}
                                className="flex-1 py-1 px-2 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-[11px] rounded-lg shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {inlineUpdatingId === prop.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3 text-gold-400" />
                                )}
                                <span>บันทึก</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditPrice}
                                disabled={inlineUpdatingId === prop.id}
                                className="py-1 px-2 bg-white hover:bg-gray-100 text-gray-600 font-semibold text-[11px] rounded-lg border border-gray-200 flex items-center justify-center gap-0.5 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                <span>ยกเลิก</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group/price relative flex items-center gap-1.5">
                            <span className="font-bold text-navy-950 text-xs">
                              {formatPrice(prop.price, prop.status)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditPrice(prop)}
                              title="คลิกเพื่อแก้ไขราคาโดยตรง (Inline Edit)"
                              className="opacity-0 group-hover/price:opacity-100 transition-opacity p-1 text-gray-400 hover:text-navy-950 hover:bg-gold-100 rounded-md border border-transparent hover:border-gold-300 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3 text-gold-600" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-gray-600">
                        {prop.district}, {prop.province}
                      </td>
                      <td className="p-3.5">
                        <div className="relative inline-status-dropdown-container">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveStatusDropdownId(activeStatusDropdownId === prop.id ? null : prop.id);
                            }}
                            disabled={inlineUpdatingId === prop.id}
                            title="คลิกเพื่อเปลี่ยนสถานะ ขาย/เช่า ทันที"
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-2xs cursor-pointer border ${
                              prop.status === 'rent'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                                : 'bg-gold-50 text-navy-950 border-gold-300 hover:bg-gold-100 hover:border-gold-400'
                            }`}
                          >
                            {inlineUpdatingId === prop.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-gray-600" />
                            ) : (
                              <span>{prop.status === 'rent' ? '🔑 เช่า' : '🏷️ ขาย'}</span>
                            )}
                            <ChevronDown className={`w-3 h-3 transition-transform ${activeStatusDropdownId === prop.id ? 'rotate-180' : ''}`} />
                          </button>

                          {activeStatusDropdownId === prop.id && (
                            <div className="absolute top-full left-0 mt-1 z-30 w-32 bg-white rounded-xl shadow-xl border border-gray-200 py-1 overflow-hidden">
                              <div className="px-2 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                สลับสถานะ
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInlineUpdateStatus(prop.id, 'sale')}
                                className={`w-full px-2.5 py-1.5 text-left text-xs font-bold flex items-center justify-between cursor-pointer ${
                                  prop.status === 'sale'
                                    ? 'bg-gold-50 text-navy-950'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>🏷️</span>
                                  <span>ขาย (Sale)</span>
                                </span>
                                {prop.status === 'sale' && <Check className="w-3 h-3 text-gold-600" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInlineUpdateStatus(prop.id, 'rent')}
                                className={`w-full px-2.5 py-1.5 text-left text-xs font-bold flex items-center justify-between cursor-pointer ${
                                  prop.status === 'rent'
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>🔑</span>
                                  <span>เช่า (Rent)</span>
                                </span>
                                {prop.status === 'rent' && <Check className="w-3 h-3 text-emerald-600" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-0.5 min-w-[130px]">
                          <div className="font-bold text-navy-950 text-xs truncate max-w-[140px]" title={prop.agent?.name}>
                            {prop.agent?.name || 'Chantakorn Property'}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              prop.agent?.rank === 'แอดมิน' ? 'bg-gold-100 text-gold-800 border border-gold-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                              {prop.agent?.rank === 'แอดมิน' ? '🛡️ แอดมิน' : '👔 นายหน้า'}
                            </span>
                          </div>
                          {prop.agent?.phone && (
                            <div className="text-[10px] text-gray-500 font-medium">
                              📞 {prop.agent.phone}
                            </div>
                          )}
                          {prop.agent?.line_id && (
                            <div className="text-[10px] text-emerald-600 truncate max-w-[130px]">
                              💬 LINE: {prop.agent.line_id}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
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
                      <td className="p-3.5 text-center">
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
                      <td className="p-3.5 text-gray-500 text-[11px]">
                        {formatThaiDate(prop.created_at)}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1">
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
                          
                          <button
                            type="button"
                            onClick={() => handleOpenLandsMapsOverlay(prop)}
                            className="p-1.5 text-navy-800 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer border border-transparent hover:border-emerald-300 transition-colors"
                            title="ตรวจสอบระวาง & โฉนดกรมที่ดิน (DOL LandsMaps Overlay)"
                          >
                            <Building2 className="w-4 h-4 text-emerald-600" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenHistory(prop)}
                            className="p-1.5 text-navy-800 hover:text-gold-700 hover:bg-gold-50 rounded-lg cursor-pointer border border-transparent hover:border-gold-300 transition-colors"
                            title="ดูประวัติการแก้ไขและปรับราคา (Property History)"
                          >
                            <History className="w-4 h-4 text-gold-600" />
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDuplicate(prop)}
                            className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="คัดลอกเป็นทรัพย์ใหม่ (Clone)"
                          >
                            <CopyPlus className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/admin/automation?propertyId=${encodeURIComponent(prop.id)}`}
                            className="p-1.5 text-gold-600 hover:text-gold-700 hover:bg-gold-50 rounded-lg cursor-pointer"
                            title="ระบบอัตโนมัติ AI (สร้างโพสต์/ร่างสัญญา/คำนวณ Yield)"
                          >
                            <Sparkles className="w-4 h-4 text-gold-600" />
                          </Link>

                          <Link
                            href={propertyHref(prop.slug)}
                            target="_blank"
                            className="p-1.5 text-gray-500 hover:text-navy-950 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="ดูบนเว็บไซต์"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <Link 
                            href={`/admin/properties/new?id=${encodeURIComponent(prop.id)}`} 
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar (When items are selected) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-navy-950 text-white px-5 py-3 rounded-2xl shadow-2xl border border-navy-800 flex flex-wrap items-center gap-3 animate-in slide-in-from-bottom-6">
          <div className="flex items-center space-x-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-gold-400"></span>
            <span>เลือกอยู่ <strong>{selectedIds.length}</strong> รายการ</span>
          </div>

          <div className="h-4 w-[1px] bg-navy-800 hidden sm:block"></div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleBulkPublish(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>เผยแพร่</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => handleBulkPublish(false)}
              className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
            >
              <span>ปรับเป็นแบบร่าง</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setBulkConfirmDelete(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบ</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-gray-400 hover:text-white text-xs font-semibold"
            >
              ✕ ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Delete Single Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
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
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                disabled={busy} 
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {bulkConfirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-surface-border text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-navy-950 text-base">ต้องการลบ {selectedIds.length} รายการที่เลือก?</h3>
            <p className="text-xs text-gray-500">
              อสังหาริมทรัพย์ทั้งหมดที่เลือกจะถูกลบออกจากระบบอย่างถาวร
            </p>
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => setBulkConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                disabled={busy} 
                onClick={handleBulkDelete}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                ยืนยันลบทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Add Modal */}
      <QuickPropertyModal
        isOpen={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
        onSuccess={(newProp) => {
          setDuplicateSuccessMessage(`🎉 ลงทรัพย์ "${newProp.title}" เรียบร้อยแล้ว!`);
          setTimeout(() => setDuplicateSuccessMessage(null), 5000);
          loadData();
        }}
      />

      {/* Property History & Audit Trail Modal */}
      <PropertyHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        property={historyModalProperty}
        onRefreshProperty={loadData}
      />

      {/* DOL LandsMaps Integration Overlay Modal */}
      <AdminLandsMapsOverlayModal
        isOpen={isLandsMapsModalOpen}
        onClose={() => setIsLandsMapsModalOpen(false)}
        property={landsMapsModalProperty}
        onPropertyUpdated={loadData}
      />

      {/* Inline Update Success Toast Notification */}
      {inlineSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-950 text-gold-300 px-4 py-3 rounded-2xl shadow-2xl border border-gold-500/40 flex items-center space-x-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xs font-bold text-white">
            {inlineSuccessToast.message}
          </div>
        </div>
      )}
    </div>
  );
}
