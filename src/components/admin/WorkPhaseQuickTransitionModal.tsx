'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ArrowRight,
  User,
  Image as ImageIcon,
  Sparkles,
  Layers,
  AlertCircle,
  Send,
  Settings2,
  Share2,
  Copy
} from 'lucide-react';
import { WorkJob } from '@/lib/types';
import { completeCurrentPhaseAndAdvance, DEFAULT_7_PHASES, generateWorkPhaseFacebookPost } from '@/lib/store/work-jobs-store';

interface WorkPhaseQuickTransitionModalProps {
  job: WorkJob | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedJob: WorkJob) => void;
  agentsList?: string[];
}

/**
 * Single-screen phase logger: one optional summary note + one big submit button.
 * Everything else (proof photos, next-phase plan, target date, agent, Facebook share)
 * lives inside a collapsed "ตัวเลือกเพิ่มเติม" section so a routine log stays 2 clicks.
 */
export default function WorkPhaseQuickTransitionModal({
  job,
  isOpen,
  onClose,
  onSuccess,
  agentsList = ['คุณจันทรกร (Admin)', 'คุณพิชชา (Agent)', 'คุณพงศกร (Agent)', 'เจ้าหน้าที่ทีมงาน'],
}: WorkPhaseQuickTransitionModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedNotes, setCompletedNotes] = useState('');

  // Optional extras (collapsed by default)
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');
  const [nextPhaseNotes, setNextPhaseNotes] = useState('');
  const [nextPhaseTargetDate, setNextPhaseTargetDate] = useState('');
  const [nextPhaseAssignedAgent, setNextPhaseAssignedAgent] = useState('');
  const [showFacebookSection, setShowFacebookSection] = useState(false);
  const [facebookPostContent, setFacebookPostContent] = useState('');
  const [copiedFb, setCopiedFb] = useState(false);

  React.useEffect(() => {
    if (job && showFacebookSection) {
      const generated = generateWorkPhaseFacebookPost(job, job.current_phase_number, completedNotes, nextPhaseNotes);
      setFacebookPostContent(generated);
    }
  }, [job, completedNotes, nextPhaseNotes, showFacebookSection]);

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

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await completeCurrentPhaseAndAdvance({
        jobId: job.id,
        completedNotes: completedNotes.trim(),
        proofPhotos,
        nextPhaseNotes: nextPhaseNotes.trim(),
        nextPhaseTargetDate,
        nextPhaseAssignedAgent: nextPhaseAssignedAgent || job.assigned_agent,
      });
      onSuccess(updated);
      onClose();
      // Reset state
      setCompletedNotes('');
      setProofPhotos([]);
      setPhotoInput('');
      setNextPhaseNotes('');
      setNextPhaseTargetDate('');
      setNextPhaseAssignedAgent('');
      setShowFacebookSection(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกเฟส');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-surface-border overflow-hidden my-8">

        {/* Header Banner */}
        <div className="bg-linear-to-r/srgb from-navy-950 via-navy-900 to-navy-950 text-white p-6 sm:p-7 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 text-gold-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Layers className="w-4 h-4" />
            <span>ลงงานเฟส {currentPhaseNum} เสร็จ & ส่งต่อทันที</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white pr-10">
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
              <span className="flex items-center gap-1 bg-navy-900/80 px-2 py-0.5 rounded-sm border border-navy-800">
                <span>ผู้บันทึก: {job.assigned_agent}</span>
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

        {/* Main Content: single screen */}
        <div className="p-6 sm:p-8 space-y-5 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-xs">
              {currentPhaseNum}
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase text-amber-800 tracking-wider">
                เฟสที่กำลังจะบันทึกว่าเสร็จ:
              </span>
              <h3 className="text-sm font-extrabold text-navy-950">
                {currentPhase?.phase_title}
              </h3>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-navy-950 flex items-center justify-between">
              <span>📝 สรุปผลการทำงานเฟส {currentPhaseNum} (ถ้ามี)</span>
              <span className="text-[10px] text-gray-400">เว้นว่างได้ &ndash; ระบบใส่สรุปให้อัตโนมัติ</span>
            </label>
            <textarea
              value={completedNotes}
              onChange={(e) => setCompletedNotes(e.target.value)}
              placeholder={`เช่น: ตรวจสอบเอกสารโฉนดเรียบร้อย ไม่พบภาระผูกพัน หรือ สำรวจแปลงที่ดินแล้วถ่ายภาพเรียบร้อย...`}
              rows={3}
              autoFocus
              className="w-full p-3.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-navy-950 focus:border-navy-950 outline-hidden transition-all"
            />
          </div>

          {/* Collapsed optional extras */}
          <details className="group rounded-2xl border border-gray-200 bg-gray-50/60">
            <summary className="cursor-pointer select-none list-none px-4 py-3 flex items-center justify-between text-xs font-bold text-navy-950">
              <span className="flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-gold-600" />
                <span>ตัวเลือกเพิ่มเติม (แนบรูป, แผนเฟสถัดไป, แชร์ Facebook)</span>
              </span>
              <span className="text-[10px] text-gray-400 group-open:hidden">แตะเพื่อเปิด</span>
              <span className="hidden text-[10px] text-gray-400 group-open:inline">แตะเพื่อพับ</span>
            </summary>

            <div className="px-4 pb-4 space-y-5 animate-in fade-in duration-200">
              {/* Proof photos */}
              <div className="space-y-2 pt-2">
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
                    className="flex-1 p-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-navy-950 outline-hidden"
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

              {/* Next phase plan (not on final phase) */}
              {nextPhaseInfo && (
                <>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
                      {currentPhaseNum + 1}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-gold-600" />
                        <span>จะส่งต่อเข้าสู่เฟสถัดไป:</span>
                      </span>
                      <h4 className="text-xs font-extrabold text-navy-950">
                        {nextPhaseInfo.phase_title}
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-navy-950">
                      🚀 รายละเอียดงาน/แผนงานสำหรับเฟส {currentPhaseNum + 1} (ถ้ามี)
                    </label>
                    <textarea
                      value={nextPhaseNotes}
                      onChange={(e) => setNextPhaseNotes(e.target.value)}
                      placeholder={`เช่น: นัดหมายช่างภาพลงพื้นที่วันพฤหัสบดีเวลา 10:00 น....`}
                      rows={2}
                      className="w-full p-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-navy-950 focus:border-navy-950 outline-hidden transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-navy-950">
                        📅 กำหนดวันคาดว่าจะเสร็จเฟสใหม่:
                      </label>
                      <input
                        type="date"
                        value={nextPhaseTargetDate}
                        onChange={(e) => setNextPhaseTargetDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-hidden focus:ring-2 focus:ring-navy-950"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-navy-950">
                        👤 ผู้รับผิดชอบงานเฟสใหม่:
                      </label>
                      <select
                        value={nextPhaseAssignedAgent || job.assigned_agent || ''}
                        onChange={(e) => setNextPhaseAssignedAgent(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-hidden focus:ring-2 focus:ring-navy-950"
                      >
                        {agentsList.map((ag) => (
                          <option key={ag} value={ag}>
                            {ag}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Facebook share (opt-in) */}
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-3">
                <label className="text-xs font-extrabold text-blue-950 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFacebookSection}
                    onChange={(e) => setShowFacebookSection(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500"
                  />
                  <span>📲 เตรียมข้อความแชร์ความคืบหน้าลง Facebook เพจ</span>
                </label>

                {showFacebookSection && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <textarea
                      value={facebookPostContent}
                      onChange={(e) => setFacebookPostContent(e.target.value)}
                      rows={5}
                      className="w-full p-3 rounded-xl border border-blue-200 text-xs bg-white text-navy-950 font-medium focus:ring-2 focus:ring-blue-600 outline-hidden leading-relaxed"
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
          </details>
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 bg-slate-50 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-colors"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <Send className="w-4 h-4 text-gold-300" />
                <span>
                  {isFinalPhase
                    ? `🎉 ลงงานเฟสสุดท้าย & ปิดงานทันที`
                    : `✅ ลงงานเฟส ${currentPhaseNum} เสร็จ & ส่งต่อเฟส ${currentPhaseNum + 1} ทันที`}
                </span>
                <ArrowRight className="w-4 h-4 text-gold-300" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
