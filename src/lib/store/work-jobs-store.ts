'use client';

import { WorkJob, WorkPhase, WorkJobStatus } from '@/lib/types';
import { db } from '@/lib/firebase/client';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { logSystemActivity } from '@/lib/store/activity-store';

const STORAGE_KEY_WORK_JOBS = 'chantakorn_work_jobs';

export const DEFAULT_7_PHASES: { phase_number: number; phase_title: string; description: string }[] = [
  {
    phase_number: 1,
    phase_title: '📥 รับเรื่องฝากขาย & ตรวจสอบเอกสารโฉนด',
    description: 'รับข้อมูลทรัพย์ ตรวจสอบโฉนดที่ดิน ระบุผู้มีกรรมสิทธิ์ และจัดเก็บเอกสารสำคัญ',
  },
  {
    phase_number: 2,
    phase_title: '🔍 สำรวจสถานที่จริง & ประเมินราคาตลาด',
    description: 'เจ้าหน้าที่ลงพื้นที่สำรวจตำแหน่งทรัพย์ เช็กสภาพแวดล้อม และประเมินราคาซื้อขายที่เหมาะสม',
  },
  {
    phase_number: 3,
    phase_title: '✍️ เซ็นสัญญาฝากขาย & ปรับปรุงสภาพทรัพย์',
    description: 'ทำสัญญาแต่งตั้งนายหน้า ตกลงค่าคอมมิชชัน และเตรียมความพร้อมสถานที่ก่อนถ่ายทำสื่อ',
  },
  {
    phase_number: 4,
    phase_title: '📸 ถ่ายภาพ/วิดีโอ 3D & จัดทำสื่อการตลาด',
    description: 'ลงพื้นที่ถ่ายรูป ทำคลิปวิดีโอ โพสต์ลงระบบ Chantakorn Property & ยิงโฆษณาโซเชียล',
  },
  {
    phase_number: 5,
    phase_title: '🎯 โปรโมตหาผู้ซื้อ / นัดพาชมทรัพย์ & เจรจาต่อรอง',
    description: 'พาผู้สนใจเข้าชมสถานที่จริง คัดกรองผู้ซื้อศักยภาพสูง และเจรจาตกลงราคาซื้อขาย',
  },
  {
    phase_number: 6,
    phase_title: '📝 ทำสัญญาจะซื้อจะขาย & ดำเนินการยื่นกู้สินเชื่อ',
    description: 'ร่างสัญญาจะซื้อจะขาย มัดจำทรัพย์ และช่วยประสานงานยื่นกู้สินเชื่อบ้านกับธนาคาร',
  },
  {
    phase_number: 7,
    phase_title: '🏛️ โอนกรรมสิทธิ์ ณ กรมที่ดิน & ส่งมอบทรัพย์ปิดการขาย',
    description: 'นัดโอนกรรมสิทธิ์ ณ กรมที่ดิน คำนวณค่าธรรมเนียม/ภาษี ชำระเงิน และส่งมอบกุญแจปิดงานสำเร็จ',
  },
];

export function generateWorkPhaseFacebookPost(
  job: WorkJob,
  completedPhaseNum: number,
  completedNotes?: string,
  nextPhaseNotes?: string
): string {
  const completedPhase = job.phases.find(p => p.phase_number === completedPhaseNum);
  const isFinal = completedPhaseNum >= job.total_phases;
  const nextPhase = !isFinal ? job.phases.find(p => p.phase_number === completedPhaseNum + 1) : null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chantakornproperty.com';
  const propertyUrl = job.property_id ? `${origin}/properties` : origin;

  return `🎉 [อัปเดตความคืบหน้างานฝากขาย & พัฒนาอสังหาริมทรัพย์]
🏡 รายการงาน: ${job.title}
🆔 รหัสงาน: ${job.job_code}
📍 ทำเล: หาดใหญ่–สงขลา

✅ ความคืบหน้าล่าสุด: เสร็จสิ้น เฟส ${completedPhaseNum} [${completedPhase?.phase_title || ''}]
💬 สรุปงาน: ${completedNotes || 'ดำเนินการสำเร็จตามแผนเรียบร้อยแล้ว'}

${isFinal ? '🏆 ปิดงานครบทั้ง 7 เฟสเรียบร้อยสมบูรณ์แบบ!' : `🚀 ส่งต่อเข้าสู่: เฟส ${completedPhaseNum + 1} [${nextPhase?.phase_title || ''}]
📍 แผนงานเฟสถัดไป: ${nextPhaseNotes || 'เริ่มต้นดำเนินงานทันที'}`}

✨ ทีมงาน ฉันทากร พร็อพเพอร์ตี้ มุ่งมั่นดูแลและให้บริการฝากขายบ้าน ที่ดิน คอนโด ในเขตหาดใหญ่–สงขลา อย่างมืออาชีพ ซื่อสัตย์ และใส่ใจทุกขั้นตอน!

📞 สนใจฝากขาย/นัดชมบ้าน โทร: 082-436-4499
💬 LINE Official: @930xzcyi
🌐 ชมคลังทรัพย์เพิ่มเติม: ${propertyUrl}

#ฝากขายบ้านหาดใหญ่ #อสังหาหาดใหญ่ #ฉันทากรพร็อพเพอร์ตี้ #บ้านมือสองหาดใหญ่ #อัปเดตเฟสงาน`;
}

function isWorkJob(item: unknown): item is WorkJob {
  if (!item || typeof item !== 'object') return false;
  const v = item as WorkJob;
  return typeof v.id === 'string' && typeof v.title === 'string' && Array.isArray(v.phases);
}

function getLocalWorkJobs(): WorkJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_WORK_JOBS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isWorkJob);
    }
  } catch {}
  return [];
}

function saveLocalWorkJobs(jobs: WorkJob[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_WORK_JOBS, JSON.stringify(jobs));
  } catch (err) {
    console.warn('Failed to save work jobs to localStorage:', err);
  }
}

export async function fetchWorkJobs(): Promise<WorkJob[]> {
  try {
    if (db) {
      const q = query(collection(db, 'work_jobs'), orderBy('updated_at', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const jobs = snap.docs.map(docSnap => docSnap.data() as WorkJob);
        saveLocalWorkJobs(jobs);
        return jobs;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch work jobs from Firestore, using local fallback:', err);
  }
  return getLocalWorkJobs();
}

export async function saveWorkJob(job: WorkJob): Promise<WorkJob> {
  const updatedJob = { ...job, updated_at: new Date().toISOString() };
  
  // Save local first
  const current = getLocalWorkJobs();
  const idx = current.findIndex(j => j.id === updatedJob.id);
  let nextList: WorkJob[];
  if (idx >= 0) {
    nextList = [...current];
    nextList[idx] = updatedJob;
  } else {
    nextList = [updatedJob, ...current];
  }
  saveLocalWorkJobs(nextList);

  // Firestore sync
  if (db) {
    try {
      await setDoc(doc(db, 'work_jobs', updatedJob.id), updatedJob, { merge: true });
    } catch (err) {
      console.warn('Failed to sync work job to Firestore:', err);
    }
  }

  return updatedJob;
}

export async function createWorkJob(params: {
  title: string;
  property_id?: string;
  property_title?: string;
  inquiry_id?: string;
  customer_name?: string;
  customer_phone?: string;
  assigned_agent?: string;
  initial_notes?: string;
  actor_name?: string;
}): Promise<WorkJob> {
  const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const codeNumber = Math.floor(1000 + Math.random() * 9000);
  const job_code = `JOB-${new Date().getFullYear()}-${codeNumber}`;
  const now = new Date().toISOString();

  const phases: WorkPhase[] = DEFAULT_7_PHASES.map((p, idx) => ({
    phase_number: p.phase_number,
    phase_title: p.phase_title,
    description: p.description,
    status: idx === 0 ? 'in_progress' : 'pending',
    started_at: idx === 0 ? now : undefined,
    assigned_agent_name: params.assigned_agent,
    notes: idx === 0 ? (params.initial_notes || 'เริ่มต้นรับเรื่องเข้าสู่ระบบ') : undefined,
  }));

  const newJob: WorkJob = {
    id,
    job_code,
    title: params.title,
    property_id: params.property_id,
    property_title: params.property_title,
    inquiry_id: params.inquiry_id,
    customer_name: params.customer_name,
    customer_phone: params.customer_phone,
    assigned_agent: params.assigned_agent || 'เจ้าหน้าที่ทีมงาน',
    current_phase_number: 1,
    total_phases: 7,
    status: 'active',
    phases,
    created_at: now,
    updated_at: now,
  };

  const saved = await saveWorkJob(newJob);

  logSystemActivity({
    category: 'work_phase',
    action: 'work_job_created',
    title: 'สร้างงานติดตามเฟสใหม่',
    description: `ลงทะเบียนงานใหม่ "${saved.title}" [${saved.job_code}] เริ่มต้นเฟส 1`,
    target_id: saved.id,
    target_name: saved.title,
    actor_name: params.actor_name || 'เจ้าหน้าที่ผู้ดูแลระบบ',
  }).catch(() => undefined);

  return saved;
}

/**
 * Core Function: Completes the current phase and immediately transitions to the next phase!
 */
export async function completeCurrentPhaseAndAdvance(params: {
  jobId: string;
  completedNotes?: string;
  proofPhotos?: string[];
  nextPhaseNotes?: string;
  nextPhaseTargetDate?: string;
  nextPhaseAssignedAgent?: string;
  actorName?: string;
}): Promise<WorkJob> {
  const jobs = await fetchWorkJobs();
  const targetJob = jobs.find(j => j.id === params.jobId);
  if (!targetJob) {
    throw new Error('ไม่พบรายการงานเฟสนี้ในระบบ');
  }

  const now = new Date().toISOString();
  const currentPhaseNum = targetJob.current_phase_number;
  const currentPhaseIdx = currentPhaseNum - 1;
  const actor = params.actorName || 'เจ้าหน้าที่ผู้ดูแลระบบ';

  // Copy phases array
  const updatedPhases = [...targetJob.phases];

  // 1. Mark current active phase as completed
  if (currentPhaseIdx >= 0 && currentPhaseIdx < updatedPhases.length) {
    updatedPhases[currentPhaseIdx] = {
      ...updatedPhases[currentPhaseIdx],
      status: 'completed',
      completed_at: now,
      completed_by: actor,
      notes: params.completedNotes || updatedPhases[currentPhaseIdx].notes || 'เสร็จสิ้นเฟสงานอย่างเรียบร้อย',
      proof_photos: params.proofPhotos && params.proofPhotos.length > 0 ? params.proofPhotos : updatedPhases[currentPhaseIdx].proof_photos,
    };
  }

  const isFinalPhase = currentPhaseNum >= targetJob.total_phases;
  let nextPhaseNum = currentPhaseNum;
  let jobStatus: WorkJobStatus = targetJob.status;

  if (isFinalPhase) {
    // Job complete!
    jobStatus = 'completed';
  } else {
    // 2. Advance to Next Phase
    nextPhaseNum = currentPhaseNum + 1;
    const nextPhaseIdx = nextPhaseNum - 1;

    if (nextPhaseIdx < updatedPhases.length) {
      updatedPhases[nextPhaseIdx] = {
        ...updatedPhases[nextPhaseIdx],
        status: 'in_progress',
        started_at: now,
        notes: params.nextPhaseNotes || `เริ่มต้นงานเฟส ${nextPhaseNum}`,
        target_completion_date: params.nextPhaseTargetDate,
        assigned_agent_name: params.nextPhaseAssignedAgent || targetJob.assigned_agent,
      };
    }
  }

  const updatedJob: WorkJob = {
    ...targetJob,
    current_phase_number: nextPhaseNum,
    status: jobStatus,
    phases: updatedPhases,
    updated_at: now,
  };

  const saved = await saveWorkJob(updatedJob);

  const prevPhaseTitle = targetJob.phases[currentPhaseIdx]?.phase_title || `เฟส ${currentPhaseNum}`;
  const nextPhaseTitle = isFinalPhase ? 'ปิดงานครบทุกเฟสสำเร็จ 🎉' : targetJob.phases[nextPhaseNum - 1]?.phase_title || `เฟส ${nextPhaseNum}`;

  logSystemActivity({
    category: 'work_phase',
    action: 'phase_advanced',
    title: isFinalPhase ? '🎉 ปิดงานครบทุกเฟสสำเร็จ' : '⚡ ลงงานเสร็จ & ส่งต่อเฟสถัดไป',
    description: isFinalPhase
      ? `งาน "${saved.title}" [${saved.job_code}] ดำเนินการเสร็จสิ้นครบ 7 เฟสเรียบร้อยแล้ว`
      : `งาน "${saved.title}" สรุปเฟส [${prevPhaseTitle}] เสร็จสิ้น ➔ ส่งต่อเข้าสู่ [${nextPhaseTitle}] ทันที`,
    target_id: saved.id,
    target_name: saved.title,
    actor_name: actor,
  }).catch(() => undefined);

  return saved;
}

export async function deleteWorkJob(jobId: string): Promise<boolean> {
  const current = getLocalWorkJobs();
  const nextList = current.filter(j => j.id !== jobId);
  saveLocalWorkJobs(nextList);

  if (db) {
    try {
      await deleteDoc(doc(db, 'work_jobs', jobId));
    } catch (err) {
      console.warn('Failed to delete work job from Firestore:', err);
    }
  }
  return true;
}
