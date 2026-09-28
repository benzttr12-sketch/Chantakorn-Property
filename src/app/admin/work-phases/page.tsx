'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Layers, 
  PlusCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  User, 
  Phone, 
  Building2, 
  Calendar, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Image as ImageIcon,
  AlertCircle,
  RotateCcw,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { WorkJob, WorkPhase } from '@/lib/types';
import { fetchWorkJobs, createWorkJob, deleteWorkJob, DEFAULT_7_PHASES } from '@/lib/store/work-jobs-store';
import { formatThaiDate } from '@/lib/utils';
import WorkPhaseQuickTransitionModal from '@/components/admin/WorkPhaseQuickTransitionModal';

export default function WorkPhasesAdminPage() {
  const [jobs, setJobs] = useState<WorkJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [selectedJob, setSelectedJob] = useState<WorkJob | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState<Record<string, boolean>>({});

  // New Job Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newAssignedAgent, setNewAssignedAgent] = useState('คุณจันทรกร (Admin)');
  const [newInitialNotes, setNewInitialNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWorkJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลเฟสงานได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenTransitionModal = (job: WorkJob) => {
    setSelectedJob(job);
    setModalOpen(true);
  };

  const handleJobUpdated = (updatedJob: WorkJob) => {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
  };

  const toggleExpand = (id: string) => {
    setExpandedJobIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('กรุณากรอกชื่อรายการงาน');
      return;
    }
    setCreating(true);
    try {
      const created = await createWorkJob({
        title: newTitle.trim(),
        customer_name: newCustomerName.trim(),
        customer_phone: newCustomerPhone.trim(),
        assigned_agent: newAssignedAgent,
        initial_notes: newInitialNotes.trim(),
      });
      setJobs(prev => [created, ...prev]);
      setCreateModalOpen(false);
      // Reset
      setNewTitle('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewInitialNotes('');
      // Open transition modal for immediate action!
      setSelectedJob(created);
      setModalOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ไม่สามารถสร้างงานใหม่ได้');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteJob = async (id: string, title: string) => {
    if (!confirm(`ยืนยันการลบงาน "${title}" ออกจากระบบหรือไม่?`)) return;
    try {
      await deleteWorkJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      alert('ไม่สามารถลบงานได้');
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        job.title.toLowerCase().includes(q) ||
        job.job_code.toLowerCase().includes(q) ||
        (job.customer_name && job.customer_name.toLowerCase().includes(q)) ||
        (job.customer_phone && job.customer_phone.includes(q)) ||
        (job.assigned_agent && job.assigned_agent.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeCount = jobs.filter(j => j.status === 'active').length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;

  return (
    <div className="space-y-6 pb-20">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 border border-navy-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-gold-400 text-xs font-bold uppercase tracking-widest mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>CHANTAKORN WORKFLOW & PHASE CONTROLLER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            ระบบติดตามและลงงานตามเฟส
          </h1>
          <p className="text-xs sm:text-sm text-navy-200 mt-1 max-w-2xl">
            บันทึกความคืบหน้างานฝากขายและพัฒนาทรัพย์ พร้อมระบบ <strong>&quot;ลงงานเสร็จ ➔ ต่อเฟสใหม่ทันที&quot;</strong> เพื่อการทำงานที่รวดเร็วและต่อเนื่อง
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-500 hover:to-gold-600 text-navy-950 font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>ลงทะเบียนงานเฟสใหม่</span>
        </button>
      </div>

      {/* KPI Stats & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-navy-950 text-white border-navy-900 shadow-md ring-2 ring-gold-400/40'
              : 'bg-white text-navy-950 border-surface-border hover:border-gray-300'
          }`}
        >
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">งานทั้งหมด</span>
          <span className="text-2xl font-black mt-0.5 block">{jobs.length} รายการ</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-gold-400/40'
              : 'bg-white text-navy-950 border-surface-border hover:border-gray-300'
          }`}
        >
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">กำลังดำเนินงาน (Active)</span>
          <span className="text-2xl font-black mt-0.5 block">{activeCount} รายการ</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('completed')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'completed'
              ? 'bg-emerald-700 text-white border-emerald-800 shadow-md ring-2 ring-gold-400/40'
              : 'bg-white text-navy-950 border-surface-border hover:border-gray-300'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">ปิดงานสมบูรณ์ครบทุกเฟส</span>
          <span className="text-2xl font-black mt-0.5 block">{completedCount} รายการ</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-2xl p-4 border border-surface-border shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาตามชื่อรหัสงาน, ชื่อทรัพย์, ชื่อลูกค้า หรือชื่อนายหน้าผู้รับผิดชอบ..."
          className="w-full text-xs font-medium outline-none bg-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-gray-400 hover:text-gray-600 font-bold"
          >
            ล้าง
          </button>
        )}
      </div>

      {/* Main Jobs List */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs">
          กำลังโหลดข้อมูลเฟสงาน...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-surface-border shadow-sm space-y-4">
          <Layers className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-navy-950">ยังไม่มีงานติดตามเฟสในส่วนนี้</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            คุณสามารถกดปุ่ม &quot;ลงทะเบียนงานเฟสใหม่&quot; ด้านบนเพื่อเริ่มบันทึกความคืบหน้าของฝากขายหรือโครงการอสังหาริมทรัพย์ได้ทันที
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-navy-950 text-white font-bold text-xs hover:bg-navy-900 transition-colors inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 text-gold-400" />
            <span>สร้างงานเฟสแรก</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const isExpanded = !!expandedJobIds[job.id];
            const activePhaseNum = job.current_phase_number;
            const activePhase = job.phases.find(p => p.phase_number === activePhaseNum);
            const isDone = job.status === 'completed';

            return (
              <div
                key={job.id}
                className={`bg-white rounded-3xl border transition-all shadow-sm hover:shadow-md overflow-hidden ${
                  isDone ? 'border-emerald-200' : 'border-surface-border'
                }`}
              >
                {/* Job Card Top Info */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-navy-950 text-gold-400 font-mono font-bold text-[11px]">
                          {job.job_code}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isDone ? '🎉 เสร็จสิ้นครบทุกเฟส' : `กำลังดำเนินงาน เฟส ${activePhaseNum}/${job.total_phases}`}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-navy-950">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-0.5">
                        {job.customer_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-gold-600" />
                            <span>ลูกค้า: <strong>{job.customer_name}</strong> {job.customer_phone ? `(${job.customer_phone})` : ''}</span>
                          </span>
                        )}
                        {job.assigned_agent && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-navy-600" />
                            <span>ผู้รับผิดชอบ: <strong>{job.assigned_agent}</strong></span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>สร้างเมื่อ: {formatThaiDate(job.created_at)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Quick Instant Transition Button */}
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => handleOpenTransitionModal(job)}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
                      >
                        <Sparkles className="w-4 h-4 text-gold-300" />
                        <span>✅ ลงงานเสร็จ & ต่อเฟสถัดไปทันที</span>
                      </button>
                    )}
                  </div>

                  {/* Active Phase Banner */}
                  {!isDone && activePhase && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-navy-950 to-navy-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-ping"></span>
                          เฟสงานที่กำลังดำเนินการ (Phase {activePhaseNum}):
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          {activePhase.phase_title}
                        </h4>
                        {activePhase.notes && (
                          <p className="text-xs text-navy-200 line-clamp-1">
                            💬 หมายเหตุ: {activePhase.notes}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenTransitionModal(job)}
                        className="px-4 py-2 rounded-xl bg-gold-400 hover:bg-gold-500 text-navy-950 font-extrabold text-xs transition-colors shrink-0 flex items-center justify-center gap-1"
                      >
                        <span>อัปเดตเฟสนี้</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Stepper Bar View */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1">
                    {job.phases.map((p) => {
                      const isCompleted = p.status === 'completed';
                      const isActive = p.phase_number === activePhaseNum && !isDone;

                      return (
                        <div
                          key={p.phase_number}
                          className={`p-2 rounded-xl border text-center transition-all ${
                            isCompleted
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : isActive
                              ? 'bg-navy-950 border-navy-900 text-white shadow-sm ring-1 ring-gold-400/50'
                              : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                        >
                          <div className="flex items-center justify-center">
                            {isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <span className={`text-[11px] font-extrabold ${isActive ? 'text-gold-400' : 'text-gray-400'}`}>
                                P{p.phase_number}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-bold block truncate mt-0.5">
                            {p.phase_title.split('&')[0].replace(/^[^\s]+\s*/, '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Accordion Toggle for Detailed Logs */}
                  <div className="flex items-center justify-between pt-2 text-xs border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleExpand(job.id)}
                      className="text-navy-900 font-bold hover:text-navy-700 flex items-center gap-1.5"
                    >
                      <span>{isExpanded ? 'ซ่อนประวัติการบันทึกงานทุกเฟส' : 'ดูรายละเอียดและประวัติการลงงานทุกเฟส'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job.id, job.title)}
                      className="text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบงานนี้</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Detailed Log Section */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-gray-200 p-5 sm:p-6 space-y-4 animate-in fade-in duration-200">
                    <h4 className="text-xs font-extrabold text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-gold-600" />
                      <span>บันทึกความคืบหน้าทั้ง 7 เฟส (Detailed Timeline)</span>
                    </h4>

                    <div className="space-y-3">
                      {job.phases.map((phase) => (
                        <div
                          key={phase.phase_number}
                          className={`p-4 rounded-2xl border bg-white ${
                            phase.status === 'completed'
                              ? 'border-emerald-200 shadow-xs'
                              : phase.status === 'in_progress'
                              ? 'border-navy-900 ring-1 ring-gold-400/40 shadow-xs'
                              : 'border-gray-200 opacity-60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                phase.status === 'completed'
                                  ? 'bg-emerald-600 text-white'
                                  : phase.status === 'in_progress'
                                  ? 'bg-navy-950 text-gold-400'
                                  : 'bg-gray-200 text-gray-500'
                              }`}>
                                {phase.phase_number}
                              </span>
                              <h5 className="text-xs font-extrabold text-navy-950">
                                {phase.phase_title}
                              </h5>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              phase.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : phase.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {phase.status === 'completed'
                                ? 'เสร็จสิ้นเรียบร้อย'
                                : phase.status === 'in_progress'
                                ? 'กำลังดำเนินงาน'
                                : 'รอคิวเฟสถัดไป'}
                            </span>
                          </div>

                          {phase.notes && (
                            <p className="text-xs text-gray-700 mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 leading-relaxed">
                              💬 <strong>บันทึก:</strong> {phase.notes}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 mt-2">
                            {phase.completed_at && (
                              <span>เสร็จเมื่อ: {formatThaiDate(phase.completed_at)}</span>
                            )}
                            {phase.completed_by && (
                              <span>ผู้บันทึก: {phase.completed_by}</span>
                            )}
                            {phase.target_completion_date && (
                              <span className="text-amber-700 font-semibold">
                                📅 กำหนดเสร็จ: {phase.target_completion_date}
                              </span>
                            )}
                          </div>

                          {phase.proof_photos && phase.proof_photos.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
                              {phase.proof_photos.map((photo, pIdx) => (
                                <a
                                  key={pIdx}
                                  href={photo}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-navy-700 font-bold bg-navy-50 hover:bg-navy-100 px-2.5 py-1 rounded-lg border border-navy-200 flex items-center gap-1"
                                >
                                  <ImageIcon className="w-3 h-3 text-gold-600" />
                                  <span>หลักฐานภาพ #{pIdx + 1}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Transition to Next Phase */}
      <WorkPhaseQuickTransitionModal
        job={selectedJob}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleJobUpdated}
      />

      {/* Modal: Create New Work Job */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-surface-border p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-extrabold text-navy-950 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-gold-600" />
                <span>ลงทะเบียนงานเฟสใหม่</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-950">
                  ชื่อรายการงาน / ทรัพย์ที่รับฝากขาย <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น: ฝากขายบ้านเดี่ยว 2 ชั้น คอหงส์ หรือ งานประเมินที่ดินควนลัง"
                  className="w-full p-3 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-navy-950 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-navy-950">ชื่อลูกค้า/ผู้ฝากขาย</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="คุณสมชาย ใจดี"
                    className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-navy-950">เบอร์โทรศัพท์ลูกค้า</label>
                  <input
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="081-234-5678"
                    className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-950">ผู้รับผิดชอบงาน</label>
                <select
                  value={newAssignedAgent}
                  onChange={(e) => setNewAssignedAgent(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-none"
                >
                  <option value="คุณจันทรกร (Admin)">คุณจันทรกร (Admin)</option>
                  <option value="คุณพิชชา (Agent)">คุณพิชชา (Agent)</option>
                  <option value="คุณพงศกร (Agent)">คุณพงศกร (Agent)</option>
                  <option value="เจ้าหน้าที่ทีมงาน">เจ้าหน้าที่ทีมงาน</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-950">หมายเหตุเริ่มต้นเฟส 1</label>
                <textarea
                  value={newInitialNotes}
                  onChange={(e) => setNewInitialNotes(e.target.value)}
                  placeholder="รายละเอียดเอกสารหรือบันทึกย่อเบื้องต้น..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-navy-950 text-white font-extrabold text-xs shadow-md hover:bg-navy-900 transition-colors"
                >
                  {creating ? 'กำลังบันทึก...' : '🚀 สร้างงาน & เริ่มเฟสแรก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
