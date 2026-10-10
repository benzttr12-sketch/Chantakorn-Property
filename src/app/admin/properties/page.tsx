'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Building2,
  PlusCircle,
  Search,
  AlertCircle,
  Download,
  CheckSquare,
  Square,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  Zap,
  X,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import CollapsiblePropertyCard from '@/components/admin/CollapsiblePropertyCard';
import {
  fetchAdminProperties,
  updateProperty,
  deleteProperty,
  createProperty,
} from '@/lib/store/properties-store';
import { Property, PropertyStatus } from '@/lib/types';
import {
  parseAdminPrice,
  toggleVisibleSelection,
  runSelectedOperations,
} from '@/lib/admin-operations';
import {
  propertyHref,
  getPropertyTypeName,
  formatPropertyCode,
  formatPropertySnippet,
  DISTRICTS_LIST,
} from '@/lib/utils';

const QuickPropertyModal = dynamic(() => import('@/components/admin/QuickPropertyModal'), {
  ssr: false,
});
const PropertyHistoryModal = dynamic(() => import('@/components/admin/PropertyHistoryModal'), {
  ssr: false,
});
const AdminLandsMapsOverlayModal = dynamic(
  () => import('@/components/admin/AdminLandsMapsOverlayModal'),
  { ssr: false },
);
const PropertyBroadcastModal = dynamic(() => import('@/components/admin/PropertyBroadcastModal'), {
  ssr: false,
});

const getCompletionScore = (prop: Property) => {
  let score = 0;
  if (prop.title && prop.title.trim().length > 3) score += 15;
  if (prop.description && prop.description.trim().length > 10) score += 15;
  if (prop.price && prop.price > 0) score += 15;
  if (prop.property_type) score += 10;
  if (prop.province && prop.district) score += 15;
  if (prop.cover_image && !prop.cover_image.includes('placeholder')) score += 15;
  if (prop.images && prop.images.length > 0) score += 10;
  if (
    (prop.bedrooms !== undefined && prop.bedrooms > 0) ||
    (prop.usable_area !== undefined && prop.usable_area > 0) ||
    (prop.land_size !== undefined && prop.land_size > 0)
  )
    score += 15;
  return Math.round((score / 110) * 100);
};

type StatusFilter = 'all' | 'sale' | 'rent' | 'featured' | 'draft' | 'published';
type SortOrder = 'newest' | 'oldest' | 'price_desc' | 'price_asc' | 'area_desc';
const statusOptions: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'published', label: 'เผยแพร่แล้ว' },
  { id: 'draft', label: 'แบบร่าง' },
  { id: 'sale', label: 'ขาย' },
  { id: 'rent', label: 'ให้เช่า' },
  { id: 'featured', label: 'ทรัพย์เด่น' },
];
function readStatusFilter(value: string | null | undefined): StatusFilter {
  return statusOptions.some((option) => option.id === value) ? (value as StatusFilter) : 'all';
}

function PropertiesContent() {
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    readStatusFilter(searchParams?.get('filter') || searchParams?.get('status')),
  );
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOrder>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [copySnippetToast, setCopySnippetToast] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicateSuccessMessage, setDuplicateSuccessMessage] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deleteConfirmId && !bulkConfirmDelete) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else document.getElementById('admin-property-search')?.focus();
    };
  }, [deleteConfirmId, bulkConfirmDelete]);

  const handleConfirmationKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !busy) {
      setDeleteConfirmId(null);
      setBulkConfirmDelete(false);
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      confirmationRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || [],
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Property History Modal State
  const [historyModalProperty, setHistoryModalProperty] = useState<Property | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // DOL LandsMaps Overlay Modal State
  const [landsMapsModalProperty, setLandsMapsModalProperty] = useState<Property | null>(null);
  const [isLandsMapsModalOpen, setIsLandsMapsModalOpen] = useState(false);

  // Manual property broadcast to all OA followers.
  const [lineModalProperty, setLineModalProperty] = useState<Property | null>(null);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);

  const handleOpenLineModal = (prop: Property) => {
    if (!prop.published) return;
    setLineModalProperty(prop);
    setIsLineModalOpen(true);
  };

  const handleOpenHistory = (prop: Property) => {
    setHistoryModalProperty(prop);
    setIsHistoryModalOpen(true);
  };

  const handleOpenLandsMapsOverlay = (prop: Property) => {
    setLandsMapsModalProperty(prop);
    setIsLandsMapsModalOpen(true);
  };

  // Collapsible Row Expansion State (Default Collapsed, Click Row to Expand Agent Notes & History)
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);

  const handleToggleExpand = (id: string) => {
    setExpandedRowIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id],
    );
  };

  const handleExpandAll = () =>
    setExpandedRowIds((previous) =>
      toggleVisibleSelection(
        previous,
        filteredProperties.map((property) => property.id),
      ),
    );

  const handleUpdatePropertyNotes = async (propId: string, notes: string) => {
    const saved = await updateProperty(propId, { internal_notes: notes });
    if (!saved) throw new Error('ไม่พบทรัพย์ที่ต้องการบันทึก');
    setProperties((prev) => prev.map((p) => (p.id === propId ? saved : p)));
  };

  // Inline Edit State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState<string>('');
  const [inlineUpdatingId, setInlineUpdatingId] = useState<string | null>(null);
  const [inlineSuccessToast, setInlineSuccessToast] = useState<{
    id: string;
    message: string;
  } | null>(null);
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
    if (inlineUpdatingId || busy) return;
    const numPrice = parseAdminPrice(inlinePriceInput);
    if (numPrice === null) {
      setError('กรุณากรอกราคาเป็นตัวเลข เช่น 6,100,000 หรือ 6100000');
      return;
    }

    setInlineUpdatingId(propId);
    setError('');
    try {
      const saved = await updateProperty(propId, { price: numPrice });
      if (!saved) throw new Error('ไม่พบทรัพย์ที่ต้องการแก้ไข');
      setProperties((previous) =>
        previous.map((property) => (property.id === propId ? saved : property)),
      );
      setEditingPriceId(null);
      setInlinePriceInput('');
      setHighlightedRowId(propId);
      setTimeout(() => setHighlightedRowId(null), 3500);
      setInlineSuccessToast({ id: propId, message: 'บันทึกราคาใหม่สำเร็จ' });
      setTimeout(() => setInlineSuccessToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกราคาได้');
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const handleInlineUpdateStatus = async (propId: string, newStatus: PropertyStatus) => {
    if (inlineUpdatingId || busy) return;
    setInlineUpdatingId(propId);
    setError('');
    try {
      const saved = await updateProperty(propId, { status: newStatus });
      if (!saved) throw new Error('ไม่พบทรัพย์ที่ต้องการแก้ไข');
      setProperties((previous) =>
        previous.map((property) => (property.id === propId ? saved : property)),
      );
      setHighlightedRowId(propId);
      setTimeout(() => setHighlightedRowId(null), 3500);
      setInlineSuccessToast({
        id: propId,
        message: `เปลี่ยนสถานะเป็น "${newStatus === 'rent' ? 'เช่า' : 'ขาย'}" เรียบร้อยแล้ว`,
      });
      setTimeout(() => setInlineSuccessToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนสถานะได้');
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const loadData = async (clearError = true) => {
    setLoading(true);
    if (clearError) setError('');
    try {
      const data = await fetchAdminProperties();
      setProperties(data);
      setSelectedIds((previous) =>
        previous.filter((id) => data.some((property) => property.id === id)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setStatusFilter(readStatusFilter(searchParams?.get('filter') || searchParams?.get('status')));
  }, [searchParams]);

  const handleToggleFeatured = async (prop: Property) => {
    if (busy || inlineUpdatingId) return;
    setBusy(true);
    setError('');
    try {
      const saved = await updateProperty(prop.id, { featured: !prop.featured });
      if (!saved) throw new Error('ไม่พบทรัพย์ที่ต้องการแก้ไข');
      setProperties((previous) =>
        previous.map((property) => (property.id === prop.id ? saved : property)),
      );
      setInlineSuccessToast({
        id: prop.id,
        message: saved.featured ? 'ตั้งเป็นทรัพย์เด่นแล้ว' : 'ยกเลิกทรัพย์เด่นแล้ว',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePublished = async (prop: Property) => {
    if (busy || inlineUpdatingId) return;
    setBusy(true);
    setError('');
    try {
      const saved = await updateProperty(prop.id, { published: !prop.published });
      if (!saved) throw new Error('ไม่พบทรัพย์ที่ต้องการแก้ไข');
      setProperties((previous) =>
        previous.map((property) => (property.id === prop.id ? saved : property)),
      );
      setInlineSuccessToast({
        id: prop.id,
        message: saved.published ? 'เผยแพร่ทรัพย์แล้ว' : 'เปลี่ยนเป็นแบบร่างแล้ว',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกสถานะไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async (prop: Property) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}${propertyHref(prop.slug)}`;
    try {
      if (!navigator.clipboard) throw new Error('ไม่สามารถคัดลอกได้ กรุณาใช้เบราว์เซอร์ที่รองรับ');
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(prop.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('คัดลอกลิงก์ไม่สำเร็จ กรุณาอนุญาตการคัดลอกในเบราว์เซอร์แล้วลองอีกครั้ง');
    }
  };

  const handleCopyCode = async (id: string) => {
    const code = formatPropertyCode(id);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch {
      setError('คัดลอกรหัสไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  };

  const handleCopySnippet = async (prop: Property) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const snippet = formatPropertySnippet(prop, { origin });
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(snippet);
      setCopiedSnippetId(prop.id);
      setCopySnippetToast({ id: prop.id, title: prop.title });
      setTimeout(() => setCopiedSnippetId(null), 2500);
      setTimeout(() => setCopySnippetToast((prev) => (prev?.id === prop.id ? null : prev)), 4500);
    } catch {
      setError('คัดลอกข้อมูลไม่สำเร็จ กรุณาอนุญาตการคัดลอกในเบราว์เซอร์แล้วลองอีกครั้ง');
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
    setBusy(true);
    setError('');
    try {
      const removed = await deleteProperty(id);
      if (!removed) throw new Error('ไม่พบทรัพย์หรือไม่สามารถลบรายการนี้ได้');
      setDeleteConfirmId(null);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
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
    if (busy || inlineUpdatingId) return;
    setSelectedIds((previous) =>
      toggleVisibleSelection(
        previous,
        filteredProperties.map((property) => property.id),
      ),
    );
  };

  const handleToggleSelect = (id: string) => {
    if (busy || inlineUpdatingId) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkPublish = async (publishStatus: boolean) => {
    if (selectedIds.length === 0 || busy || inlineUpdatingId) return;
    const count = selectedIds.length;
    setBusy(true);
    setError('');
    try {
      const result = await runSelectedOperations(selectedIds, (id) =>
        updateProperty(id, { published: publishStatus }),
      );
      setSelectedIds(result.failed);
      if (result.succeeded.length > 0)
        setDuplicateSuccessMessage(
          `${publishStatus ? 'เผยแพร่' : 'เปลี่ยนเป็นแบบร่าง'} เรียบร้อย ${result.succeeded.length} จาก ${count} รายการ`,
        );
      if (result.failed.length > 0)
        setError(
          `บันทึกไม่สำเร็จ ${result.failed.length} รายการ กรุณาตรวจรายการที่ยังไม่สำเร็จและลองใหม่`,
        );
      setTimeout(() => setDuplicateSuccessMessage(null), 5000);
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถแก้ไขสถานะรายการที่เลือกได้');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || busy || inlineUpdatingId) return;
    const count = selectedIds.length;
    setBusy(true);
    setError('');
    try {
      const result = await runSelectedOperations(selectedIds, (id) => deleteProperty(id));
      setSelectedIds(result.failed);
      setBulkConfirmDelete(false);
      if (result.succeeded.length > 0)
        setDuplicateSuccessMessage(`ลบเรียบร้อย ${result.succeeded.length} จาก ${count} รายการ`);
      if (result.failed.length > 0)
        setError(
          `ลบไม่สำเร็จ ${result.failed.length} รายการ กรุณาตรวจรายการที่ยังไม่สำเร็จและลองใหม่`,
        );
      setTimeout(() => setDuplicateSuccessMessage(null), 5000);
      await loadData(false);
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
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
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
      'ลิงก์ (Slug)',
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
      escapeCSV(p.slug || ''),
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `chantakorn_properties_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const allVisibleSelected =
    filteredProperties.length > 0 &&
    filteredProperties.every((property) => selectedIds.includes(property.id));
  const allVisibleExpanded =
    filteredProperties.length > 0 &&
    filteredProperties.every((property) => expandedRowIds.includes(property.id));
  const activeFilterCount = Number(districtFilter !== 'all') + Number(typeFilter !== 'all');
  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || activeFilterCount > 0;
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDistrictFilter('all');
    setTypeFilter('all');
  };
  const statusCount = (id: StatusFilter) =>
    properties.filter(
      (property) =>
        id === 'all' ||
        (id === 'draft'
          ? !property.published
          : id === 'published'
            ? property.published
            : id === 'featured'
              ? property.featured
              : property.status === id),
    ).length;

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">
            PROPERTY WORKSPACE
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">
            จัดการทรัพย์
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            แก้ไขประกาศ ดูบันทึกทีม และส่งทรัพย์ให้ผู้ติดตาม LINE OA
          </p>
        </div>
        <Link
          id="add-new-property-btn"
          href="/admin/properties/new"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-navy-900"
        >
          <PlusCircle className="h-4 w-4 text-gold-400" />
          เพิ่มทรัพย์ใหม่
        </Link>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="min-h-10 rounded-lg bg-white px-3 font-semibold disabled:opacity-50"
          >
            โหลดข้อมูลใหม่
          </button>
        </div>
      )}
      {duplicateSuccessMessage && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <span>{duplicateSuccessMessage}</span>
          <button
            type="button"
            onClick={() => setDuplicateSuccessMessage(null)}
            aria-label="ปิดข้อความสำเร็จ"
            className="rounded-lg p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {inlineSuccessToast && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {inlineSuccessToast.message}
        </p>
      )}
      {copySnippetToast && (
        <p
          role="status"
          className="rounded-2xl border border-gold-200 bg-gold-50 p-4 text-sm text-navy-950"
        >
          คัดลอกข้อมูล “{copySnippetToast.title}” พร้อมนำไปโพสต์หรือส่งลูกค้าแล้ว
        </p>
      )}

      <section
        aria-label="ค้นหาและกรองทรัพย์"
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="admin-property-search" className="sr-only">
              ค้นหาชื่อทรัพย์ อำเภอ หรือรหัสทรัพย์
            </label>
            <input
              id="admin-property-search"
              type="search"
              placeholder="ค้นหาชื่อทรัพย์ อำเภอ หรือรหัส CK…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-base text-navy-950 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="property-extra-filters"
            onClick={() => setFiltersOpen((value) => !value)}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${filtersOpen || activeFilterCount ? 'border-gold-300 bg-gold-50 text-navy-950' : 'border-slate-200 text-slate-600'}`}
          >
            <ArrowUpDown className="h-4 w-4" />
            ตัวกรองเพิ่มเติม
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-navy-950 px-1.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="สถานะทรัพย์">
          {statusOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={statusFilter === option.id}
              onClick={() => setStatusFilter(option.id)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition ${statusFilter === option.id ? 'bg-navy-950 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              {option.label}
              <span
                className={`rounded-full px-1.5 text-xs ${statusFilter === option.id ? 'bg-white/15 text-gold-200' : 'bg-white text-slate-500'}`}
              >
                {loading ? '—' : statusCount(option.id)}
              </span>
            </button>
          ))}
        </div>
        {filtersOpen && (
          <div
            id="property-extra-filters"
            className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3"
          >
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              อำเภอ
              <select
                value={districtFilter}
                onChange={(event) => setDistrictFilter(event.target.value)}
                className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-950"
              >
                <option value="all">ทุกอำเภอ</option>
                {DISTRICTS_LIST.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              ประเภททรัพย์
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-950"
              >
                <option value="all">ทุกประเภท</option>
                <option value="house">บ้าน / ทาวน์โฮม</option>
                <option value="land">ที่ดิน</option>
                <option value="condo">คอนโดมิเนียม</option>
                <option value="commercial">อาคารพาณิชย์</option>
                <option value="investment">เพื่อการลงทุน</option>
                <option value="consignment">ขายฝาก / จำนอง</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              เรียงตาม
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOrder)}
                className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-950"
              >
                <option value="newest">วันที่ล่าสุด</option>
                <option value="oldest">วันที่เก่าสุด</option>
                <option value="price_desc">ราคาสูงไปต่ำ</option>
                <option value="price_asc">ราคาต่ำไปสูง</option>
                <option value="area_desc">พื้นที่ใช้สอยมากไปน้อย</option>
              </select>
            </label>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p aria-live="polite" className="text-sm text-slate-500">
            {loading
              ? 'กำลังโหลดข้อมูล…'
              : `แสดง ${filteredProperties.length} จาก ${properties.length} รายการ`}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-9 rounded-lg px-2 text-sm font-semibold text-navy-950 underline underline-offset-4"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={
              loading || busy || inlineUpdatingId !== null || filteredProperties.length === 0
            }
            onClick={handleSelectAll}
            aria-pressed={allVisibleSelected}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-navy-950 disabled:opacity-50"
          >
            {allVisibleSelected ? (
              <CheckSquare className="h-4 w-4 text-gold-600" />
            ) : (
              <Square className="h-4 w-4 text-slate-400" />
            )}
            {allVisibleSelected ? 'ยกเลิกการเลือกที่แสดง' : 'เลือกที่แสดงทั้งหมด'}
          </button>
          <button
            type="button"
            disabled={
              loading || busy || inlineUpdatingId !== null || filteredProperties.length === 0
            }
            onClick={handleExpandAll}
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50"
          >
            {allVisibleExpanded ? 'ย่อเครื่องมือทั้งหมด' : 'เปิดเครื่องมือทั้งหมด'}
          </button>
        </div>
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-navy-950">
            เครื่องมือจัดการ
          </summary>
          <div className="grid gap-1 border-t border-slate-100 p-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loading}
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              โหลดข้อมูลใหม่
            </button>
            <button
              id="export-csv-btn"
              type="button"
              onClick={handleExportCSV}
              disabled={
                loading || busy || inlineUpdatingId !== null || filteredProperties.length === 0
              }
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              ส่งออก CSV
            </button>
            <button
              type="button"
              onClick={() => setQuickModalOpen(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Zap className="h-4 w-4 text-gold-600" />
              เพิ่มจากข้อความ
            </button>
            <Link
              href="/admin/automation"
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Sparkles className="h-4 w-4 text-gold-600" />
              เครื่องมือ AI
            </Link>
          </div>
        </details>
      </div>

      {selectedIds.length > 0 && (
        <section
          aria-label="จัดการทรัพย์ที่เลือก"
          className="space-y-3 rounded-2xl bg-navy-950 p-4 text-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              เลือกไว้ {selectedIds.length} รายการ
              {selectedIds.some(
                (id) => !filteredProperties.some((property) => property.id === id),
              ) && <span className="ml-1 font-normal text-slate-300">(รวมรายการนอกตัวกรอง)</span>}
            </p>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={busy}
              className="min-h-9 px-2 text-sm text-slate-300 underline underline-offset-4 disabled:opacity-50"
            >
              ยกเลิกการเลือก
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || loading || inlineUpdatingId !== null}
              onClick={() => handleBulkPublish(true)}
              className="min-h-11 rounded-xl bg-gold-400 px-4 text-sm font-semibold text-navy-950 disabled:opacity-50"
            >
              เผยแพร่ที่เลือก
            </button>
            <button
              type="button"
              disabled={busy || loading || inlineUpdatingId !== null}
              onClick={() => handleBulkPublish(false)}
              className="min-h-11 rounded-xl border border-white/20 px-4 text-sm font-semibold disabled:opacity-50"
            >
              เปลี่ยนเป็นแบบร่าง
            </button>
            <button
              type="button"
              disabled={busy || loading || inlineUpdatingId !== null}
              onClick={() => setBulkConfirmDelete(true)}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"
            >
              ลบที่เลือก
            </button>
            {busy && (
              <span
                role="status"
                className="inline-flex items-center gap-2 px-2 text-sm text-slate-300"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังบันทึก…
              </span>
            )}
          </div>
        </section>
      )}

      {loading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-12 text-sm text-slate-500"
        >
          <Loader2 className="h-5 w-5 animate-spin text-gold-600" />
          กำลังโหลดรายการทรัพย์…
        </div>
      ) : sortedProperties.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="text-lg font-semibold text-navy-950">
            {error
              ? 'ยังแสดงรายการทรัพย์ไม่ได้'
              : hasFilters
                ? 'ไม่พบทรัพย์ตามเงื่อนไข'
                : 'ยังไม่มีทรัพย์ในระบบ'}
          </h2>
          <p className="text-sm text-slate-500">
            {error
              ? 'ลองโหลดข้อมูลใหม่อีกครั้ง'
              : hasFilters
                ? 'ลองใช้คำค้นอื่น หรือล้างตัวกรองเพื่อดูรายการทั้งหมด'
                : 'เริ่มเพิ่มทรัพย์แรก พร้อมรูป ราคา และข้อมูลติดต่อ'}
          </p>
          {hasFilters && !error && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-navy-950"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {sortedProperties.map((prop) => (
            <CollapsiblePropertyCard
              key={prop.id}
              property={prop}
              isSelected={selectedIds.includes(prop.id)}
              isExpanded={expandedRowIds.includes(prop.id)}
              isHighlighted={highlightedRowId === prop.id}
              onToggleSelect={handleToggleSelect}
              onToggleExpand={handleToggleExpand}
              onStartEditPrice={handleStartEditPrice}
              onSaveInlinePrice={handleSaveInlinePrice}
              editingPriceId={editingPriceId}
              inlinePriceInput={inlinePriceInput}
              setInlinePriceInput={setInlinePriceInput}
              onCancelEditPrice={handleCancelEditPrice}
              inlineUpdatingId={inlineUpdatingId}
              onInlineUpdateStatus={handleInlineUpdateStatus}
              onTogglePublished={handleTogglePublished}
              onToggleFeatured={handleToggleFeatured}
              onCopyCode={handleCopyCode}
              copiedCodeId={copiedCodeId}
              onCopyLink={handleCopyLink}
              copiedId={copiedId}
              onCopySnippet={handleCopySnippet}
              copiedSnippetId={copiedSnippetId}
              onOpenLandsMaps={handleOpenLandsMapsOverlay}
              onOpenHistoryModal={handleOpenHistory}
              onOpenLineModal={handleOpenLineModal}
              onDuplicate={handleDuplicate}
              onDeleteConfirm={setDeleteConfirmId}
              onUpdateNotes={handleUpdatePropertyNotes}
              completionScore={getCompletionScore(prop)}
              busy={busy}
            />
          ))}
        </div>
      )}
      {/* Delete Single Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            ref={confirmationRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-property-title"
            onKeyDown={handleConfirmationKeyDown}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-surface-border text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 id="delete-property-title" className="font-bold text-navy-950 text-base">
              ลบทรัพย์ {formatPropertyCode(deleteConfirmId)}?
            </h3>
            <p className="text-xs text-gray-500">
              การลบรายการนี้จะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?
            </p>
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 min-h-11 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 min-h-11 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
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
          <div
            ref={confirmationRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-properties-title"
            onKeyDown={handleConfirmationKeyDown}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-surface-border text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 id="delete-properties-title" className="font-bold text-navy-950 text-base">
              ต้องการลบ {selectedIds.length} รายการที่เลือก?
            </h3>
            <p className="text-xs text-gray-500">
              อสังหาริมทรัพย์ทั้งหมดที่เลือกจะถูกลบออกจากระบบอย่างถาวร
            </p>
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setBulkConfirmDelete(false)}
                className="flex-1 min-h-11 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleBulkDelete}
                className="flex-1 min-h-11 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                ยืนยันลบทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Add Modal */}
      {quickModalOpen && (
        <QuickPropertyModal
          isOpen={quickModalOpen}
          onClose={() => setQuickModalOpen(false)}
          onSuccess={(newProp) => {
            setDuplicateSuccessMessage(`🎉 ลงทรัพย์ "${newProp.title}" เรียบร้อยแล้ว!`);
            setTimeout(() => setDuplicateSuccessMessage(null), 5000);
            loadData();
          }}
        />
      )}

      {/* Property History & Audit Trail Modal */}
      {isHistoryModalOpen && (
        <PropertyHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          property={historyModalProperty}
          onRefreshProperty={loadData}
        />
      )}

      {/* DOL LandsMaps Integration Overlay Modal */}
      {isLandsMapsModalOpen && (
        <AdminLandsMapsOverlayModal
          isOpen={isLandsMapsModalOpen}
          onClose={() => setIsLandsMapsModalOpen(false)}
          property={landsMapsModalProperty}
          allProperties={properties}
          onPropertyUpdated={loadData}
        />
      )}

      {/* Review the property before broadcasting to OA followers. */}
      {lineModalProperty && (
        <PropertyBroadcastModal
          isOpen={isLineModalOpen}
          onClose={() => {
            setIsLineModalOpen(false);
            setLineModalProperty(null);
          }}
          propertyId={lineModalProperty.id}
        />
      )}
    </div>
  );
}

export default function AdminPropertiesPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8 text-center text-sm text-slate-500">
          กำลังโหลดรายการทรัพย์…
        </p>
      }
    >
      <PropertiesContent />
    </Suspense>
  );
}
