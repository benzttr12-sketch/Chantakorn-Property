'use client';

import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Calendar, 
  User, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  Plus, 
  Layers, 
  AlertCircle,
  Upload,
  Send,
  Building2,
  Check
} from 'lucide-react';
import { WorkJob, WorkPhase } from '@/lib/types';
import { completeCurrentPhaseAndAdvance, DEFAULT_7_PHASES, generateWorkPhaseFacebookPost } from '@/lib/store/work-jobs-store';
import { formatThaiDate } from '@/lib/utils';
import { Share2, Copy } from 'lucide-react';

interface WorkPhaseQuickTransitionModalProps {
  job: WorkJob | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedJob: WorkJob) => void;
  agentsList?: string[];
}

export default function WorkPhaseQuickTransitionModal({
  job,
  isOpen,
  onClose,
  onSuccess,
  agentsList = ['คุณจันทรกร (Admin)', 'คุณพิชชา (Agent)', 'คุณพงศกร (Agent)', 'เจ้าหน้าที่ทีมงาน'],
}: WorkPhaseQuickTransitionModalProps) {
  const [step, setStep] = useState<'summary' | 'next_phase'>('summary');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form states for completing current phase
  const [completedNotes, setCompletedNotes] = useState('');
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');

  // Form states for starting next phase
  const [nextPhaseNotes, setNextPhaseNotes] = useState('');
  const [nextPhaseTargetDate, setNextPhaseTargetDate] = useState('');
  const [nextPhaseAssignedAgent, setNextPhaseAssignedAgent] = useState('');
  const [actorName, setActorName] = useState('เจ้าหน้าที่ผู้ดูแลระบบ');

  // Facebook Auto-Post states
  const [showFacebookSection, setShowFacebookSection] = useState(true);
  const [facebookPostContent, setFacebookPostContent] = useState('');
  const [copiedFb, setCopiedFb] = useState(false);

  React.useEffect(() => {
    if (job) {
      const generated = generateWorkPhaseFacebookPost(
        job,
        job.current_phase_number,
        completedNotes,
        nextPhaseNotes
      );
      setFacebookPostContent(generated);
    }
  }, [job, completedNotes, nextPhaseNotes]);

  if (!isOpen || !job) return null;

  const currentPhaseNum = job.current_phase_number;
  const currentPhase = job.phases.find(p => p.phase_number === currentPhaseNum);
  const isFinalPhase = currentPhaseNum >= job.total_phases;
  const nextPhaseInfo = !isFinalPhase ? DEFAULT_7_PHASES[currentPhaseNum] : null;

  const handleCopyFacebookContent = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(facebookPostContent);
      setCopiedFb(true);
      setTimeout(() => setCopiedFb(false), 2500);
    }
  };

  const handleShareToFacebook = () => {
    handleCopyFacebookContent();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chantakornproperty.com';
    const targetUrl = job.property_id ? `${origin}/properties` : origin;
    const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}&quote=${encodeURIComponent(facebookPostContent)}`;
    window.open(fbShareUrl, '_blank', 'width=600,height=600');
  };

  const handleAddPhoto = () => {
    if (photoInput.trim()) {
      setProofPhotos(prev => [...prev, photoInput.trim()]);
      setPhotoInput('');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setProofPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleProceedToNextStep = () => {
    if (isFinalPhase) {
      // If final phase, go straight to submit
      handleFinalSubmit();
    } else {
      setStep('next_phase');
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await completeCurrentPhaseAndAdvance({
        jobId: job.id,
        completedNotes: completedNotes.trim() || `ทำตามเป้าหมายเฟส ${currentPhaseNum} เรียบร้อย`,
        proofPhotos,
        nextPhaseNotes: nextPhaseNotes.trim(),
        nextPhaseTargetDate,
        nextPhaseAssignedAgent: nextPhaseAssignedAgent || job.assigned_agent,
        actorName,
      });

      onSuccess(updated);
      onClose();
      // Reset state
      setStep('summary');
      setCompletedNotes('');
      setProofPhotos([]);
      setNextPhaseNotes('');
      setNextPhaseTargetDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกเฟส');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-surface-border overflow-hidden my-8">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white p-6 sm:p-7 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-gold-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Layers className="w-4 h-4" />
            <span>ระบบบันทึกงานเสร็จ & ส่งต่อเฟสถัดไปทันที</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white">
            {job.title}
          </h2>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-navy-200">
            <span className="px-2.5 py-1 rounded-lg bg-navy-800 border border-navy-700 font-mono font-semibold text-gold-400">
              {job.job_code}
            </span>
            {job.customer_name && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gold-400" />
                <span>ลูกค้า: {job.customer_name}</span>
              </span>
            )}
            {job.assigned_agent && (
              <span className="flex items-center gap-1 bg-navy-900/80 px-2 py-0.5 rounded border border-navy-800">
                <span>ผู้รับผิดชอบ: {job.assigned_agent}</span>
              </span>
            )}
          </div>
        </div>

        {/* Phase Stepper Bar */}
        <div className="bg-slate-50 border-b border-gray-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-navy-950 uppercase tracking-wide flex items-center gap-1.5">
              <span>ความคืบหน้าเฟสงาน ({job.current_phase_number}/{job.total_phases})</span>
            </span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              job.status === 'completed'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {job.status === 'completed' ? '🎉 ปิดงานครบทุกเฟสแล้ว' : `กำลังดำเนินงาน เฟส ${job.current_phase_number}`}
            </span>
          </div>

          {/* Stepper Dots/Boxes */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {job.phases.map((p) => {
              const isDone = p.status === 'completed';
              const isCurrent = p.phase_number === job.current_phase_number && job.status !== 'completed';
              
              return (
                <div
                  key={p.phase_number}
                  className={`p-2 rounded-xl text-center border transition-all ${
                    isDone
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : isCurrent
                      ? 'bg-navy-950 border-navy-900 text-white shadow-md ring-2 ring-gold-400/50'
                      : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className={`text-xs font-bold ${isCurrent ? 'text-gold-400' : 'text-gray-400'}`}>
                        P{p.phase_number}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium block truncate mt-0.5 max-w-full">
                    {p.phase_title.split('&')[0].replace(/^[^\s]+\s*/, '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Complete Current Phase */}
          {step === 'summary' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-sm">
                  {currentPhaseNum}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase text-amber-800 tracking-wider">
                    เฟสปัจจุบันที่กำลังทำงาน:
                  </span>
                  <h3 className="text-sm font-extrabold text-navy-950">
                    {currentPhase?.phase_title}
                  </h3>
                  {currentPhase?.description && (
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {currentPhase.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Form Input: Complete Current Phase Notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-950 flex items-center justify-between">
                  <span>📝 สรุปผลการทำงานเฟส {currentPhaseNum} (เสร็จสิ้นอะไรบ้าง) <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-gray-400">บันทึกข้อความสรุปผลงาน</span>
                </label>
                <textarea
                  value={completedNotes}
                  onChange={(e) => setCompletedNotes(e.target.value)}
                  placeholder={`เช่น: ตรวจสอบเอกสารโฉนดเรียบร้อย ไม่พบภาระผูกพัน หรือ สำรวจแปลงที่ดินแล้วถ่ายภาพเรียบร้อย...`}
                  rows={3}
                  className="w-full p-3.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-navy-950 focus:border-navy-950 outline-none transition-all"
                />
              </div>

              {/* Form Input: Attach Proof Photos */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-gold-600" />
                  <span>📸 แนบลิงก์รูปภาพ/เอกสารหลักฐานงานเฟสนี้ (ถ้ามี)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 p-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-navy-950 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhoto}
                    className="px-4 py-2.5 rounded-xl bg-navy-100 hover:bg-navy-200 text-navy-900 text-xs font-bold transition-colors"
                  >
                    เพิ่มรูป
                  </button>
                </div>

                {proofPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {proofPhotos.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 text-xs border border-gray-200">
                        <span className="truncate max-w-[180px] text-gray-700">{url}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="text-red-500 font-bold hover:text-red-700 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actor Name */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-semibold text-gray-600">
                  ชื่อเจ้าหน้าที่ผู้ลงงาน/ผู้บันทึก:
                </label>
                <input
                  type="text"
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs font-medium"
                />
              </div>
            </div>
          )}

          {/* Step 2: Set Details for Next Phase */}
          {step === 'next_phase' && !isFinalPhase && nextPhaseInfo && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-sm">
                  {currentPhaseNum + 1}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-gold-600" />
                    <span>กำลังเข้าสู่เฟสถัดไปทันที:</span>
                  </span>
                  <h3 className="text-sm font-extrabold text-navy-950">
                    {nextPhaseInfo.phase_title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {nextPhaseInfo.description}
                  </p>
                </div>
              </div>

              {/* Next Phase Action Plan Notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-950 flex items-center justify-between">
                  <span>🚀 รายละเอียดงาน/แผนงานสำหรับเฟส {currentPhaseNum + 1}</span>
                  <span className="text-[10px] text-gray-400">คำสั่งงานหรือเช็กลิสต์เฟสใหม่</span>
                </label>
                <textarea
                  value={nextPhaseNotes}
                  onChange={(e) => setNextPhaseNotes(e.target.value)}
                  placeholder={`เช่น: นัดหมายช่างภาพลงพื้นที่วันพฤหัสบดีเวลา 10:00 น. หรือ ร่างเอกสารสัญญาเตรียมส่งลูกค้า...`}
                  rows={3}
                  className="w-full p-3.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-navy-950 focus:border-navy-950 outline-none transition-all"
                />
              </div>

              {/* Target Completion Date & Assigned Agent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-navy-950 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gold-600" />
                    <span>📅 กำหนดวันคาดว่าจะเสร็จเฟสใหม่:</span>
                  </label>
                  <input
                    type="date"
                    value={nextPhaseTargetDate}
                    onChange={(e) => setNextPhaseTargetDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-none focus:ring-2 focus:ring-navy-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-navy-950 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gold-600" />
                    <span>👤 ผู้รับผิดชอบงานเฟสใหม่:</span>
                  </label>
                  <select
                    value={nextPhaseAssignedAgent || job.assigned_agent || ''}
                    onChange={(e) => setNextPhaseAssignedAgent(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-none focus:ring-2 focus:ring-navy-950"
                  >
                    {agentsList.map((ag) => (
                      <option key={ag} value={ag}>
                        {ag}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Facebook Auto Post Box */}
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-blue-950 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFacebookSection}
                      onChange={(e) => setShowFacebookSection(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span>📲 โพสต์/แชร์อัปเดตความคืบหน้าเฟสงานลง Facebook เพจอัตโนมัติ</span>
                  </label>
                  <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                    Auto Facebook Post
                  </span>
                </div>

                {showFacebookSection && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <textarea
                      value={facebookPostContent}
                      onChange={(e) => setFacebookPostContent(e.target.value)}
                      rows={5}
                      className="w-full p-3 rounded-xl border border-blue-200 text-xs bg-white text-navy-950 font-medium focus:ring-2 focus:ring-blue-600 outline-none leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCopyFacebookContent}
                        className="px-3.5 py-2 rounded-xl bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-blue-600" />
                        <span>{copiedFb ? '✓ คัดลอกข้อความสำเร็จ!' : 'คัดลอกข้อความ Facebook'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShareToFacebook}
                        className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>🚀 โพสต์/แชร์ลง Facebook เพจทันที</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 bg-slate-50 border-t border-gray-200 flex items-center justify-between gap-3">
          {step === 'next_phase' ? (
            <button
              type="button"
              onClick={() => setStep('summary')}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-navy-900 font-bold text-xs hover:bg-gray-100 transition-colors"
            >
              ← ย้อนกลับแก้ไขสรุปเฟส {currentPhaseNum}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-colors"
            >
              ยกเลิก
            </button>
          )}

          {step === 'summary' ? (
            <button
              type="button"
              onClick={handleProceedToNextStep}
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 hover:from-navy-900 hover:to-navy-800 text-white font-extrabold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <span>{isFinalPhase ? '🎉 บันทึกปิดงานสมบูรณ์ทุกเฟส' : `✅ บันทึกเฟส ${currentPhaseNum} เสร็จ & ไปเฟสถัดไป`}</span>
              <ArrowRight className="w-4 h-4 text-gold-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <span>กำลังบันทึกข้อมูล...</span>
              ) : (
                <>
                  <Send className="w-4 h-4 text-gold-300" />
                  <span>🚀 ยืนยันบันทึกเปิดเฟส {currentPhaseNum + 1} ทันที</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
