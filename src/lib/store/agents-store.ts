'use client';

import { ExtendedAgent, AGENTS as DEFAULT_AGENTS } from '@/data/agents';
import type { UserProfile } from '@/lib/types';
import { db } from '@/lib/firebase/client';
import { supabase } from '@/lib/supabase/client';
import { dataBackend } from '@/lib/backend';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

const LOCAL_KEY = 'chantakorn_featured_agents_v1';
let inMemoryAgents: ExtendedAgent[] = [];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function publish(agents: ExtendedAgent[]): ExtendedAgent[] {
  inMemoryAgents = clone(agents);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: clone(agents) }));
  return getAgents();
}

function requireConnection() {
  if (dataBackend === 'firebase' && !db) throw new Error('ระบบฐานข้อมูล Firebase ยังไม่ได้ตั้งค่า');
  if (dataBackend === 'supabase' && !supabase) throw new Error('ระบบฐานข้อมูล Supabase ยังไม่ได้ตั้งค่า');
}

function normalize(agent: Partial<ExtendedAgent>): ExtendedAgent {
  return {
    id: agent.id || '', user_id: agent.user_id, name: agent.name || '', rank: agent.rank || 'นายหน้า',
    title: agent.title || '', phone: agent.phone || '', line_id: agent.line_id || '', facebook: agent.facebook || '',
    email: agent.email || '', photo_url: agent.photo_url || '', bio: agent.bio || '', specialty: agent.specialty || '',
    zone: agent.zone || '', experienceYears: agent.experienceYears ?? 0, closedDeals: agent.closedDeals ?? 0,
    rating: agent.rating ?? 0, languages: Array.isArray(agent.languages) ? [...agent.languages] : [],
  };
}

function validate(agent: ExtendedAgent) {
  if (!agent.id || agent.id.length > 120 || agent.id.includes('/') || !agent.name.trim() || agent.name.length > 200) throw new Error('กรุณาระบุชื่อนายหน้าและรหัสรายการให้ถูกต้อง');
  // Profile photos may be compressed data URLs from the existing avatar uploader.
  for (const [field, max] of Object.entries({ title: 300, phone: 50, line_id: 200, facebook: 2000, email: 254, photo_url: 700000, bio: 4000, specialty: 1000, zone: 500 })) {
    const value = agent[field as keyof ExtendedAgent];
    if (typeof value !== 'string' || value.length > max) throw new Error('ข้อมูลนายหน้าบางรายการยาวเกินกำหนด');
  }
  if (![agent.experienceYears, agent.closedDeals, agent.rating].every(value => Number.isFinite(value) && value >= 0) || agent.rating > 5 || agent.experienceYears > 100 || agent.closedDeals > 1000000 || agent.languages.length > 10 || agent.languages.some(value => typeof value !== 'string' || value.length > 50)) throw new Error('กรุณาตรวจสอบประสบการณ์ จำนวนงาน และคะแนนของนายหน้า');
}

function localWrite(agents: ExtendedAgent[]) {
  if (typeof window === 'undefined') throw new Error('โหมดทดลองต้องใช้งานผ่านเบราว์เซอร์');
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(agents));
}

function supabaseRow(agent: ExtendedAgent) {
  const { id, name, title, phone, line_id, facebook, email, photo_url, bio, ...metadata } = agent;
  return { id, name, title, phone, line_id, facebook, email, photo_url, bio, metadata };
}

async function persistAgent(agent: ExtendedAgent) {
  requireConnection();
  validate(agent);
  if (dataBackend === 'firebase') {
    await setDoc(doc(db!, 'agents', agent.id), clone(agent), { merge: true });
  } else if (dataBackend === 'supabase') {
    const { data, error } = await supabase!.from('agents').upsert(supabaseRow(agent), { onConflict: 'id' }).select('id');
    if (error) throw error;
    if (!data?.some(row => row.id === agent.id)) throw new Error('บันทึกนายหน้าไม่สำเร็จ กรุณาตรวจสอบสิทธิ์');
  }
}

export function getAgents(): ExtendedAgent[] { return clone(inMemoryAgents); }

export async function fetchAgents(): Promise<ExtendedAgent[]> {
  requireConnection();
  if (dataBackend === 'firebase') {
    const snapshot = await getDocs(collection(db!, 'agents'));
    return publish(snapshot.docs.map(item => normalize({ ...item.data(), id: item.id })));
  }
  if (dataBackend === 'supabase') {
    const { data, error } = await supabase!.from('agents').select('*').order('name');
    if (error) throw error;
    return publish((data || []).map(row => normalize({ ...row, ...row.metadata, id: row.id })));
  }
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(LOCAL_KEY);
    if (stored !== null) {
      const rows = JSON.parse(stored);
      if (!Array.isArray(rows)) throw new Error('ข้อมูลนายหน้าในโหมดทดลองไม่ถูกต้อง');
      return publish(rows.map(normalize));
    }
  }
  return getAgents();
}

export async function saveAgentsToCloud(agents: ExtendedAgent[]): Promise<void> {
  requireConnection();
  const next = agents.map(normalize);
  next.forEach(validate);
  if (dataBackend === 'local') localWrite(next);
  else await Promise.all(next.map(persistAgent));
  publish(next);
}

export async function saveAgents(agents: ExtendedAgent[]): Promise<void> { await saveAgentsToCloud(agents); }

export async function resetAgentsToDefault(): Promise<ExtendedAgent[]> {
  if (dataBackend !== 'local') throw new Error('ข้อมูลตัวอย่างใช้ได้เฉพาะโหมดทดลอง');
  await saveAgents(DEFAULT_AGENTS);
  return getAgents();
}

/** Reflect real profile fields in the current view. Reading profiles never writes agents. */
export function syncAgentsFromUsers(users: UserProfile[]): ExtendedAgent[] {
  if (!Array.isArray(users)) return getAgents();
  const next = getAgents();
  for (const user of users) {
    if (!['ADMIN', 'AGENT'].includes(user.role)) continue;
    const index = next.findIndex(agent => agent.user_id === user.id || agent.id === user.id || agent.id === `agent-${user.id}` || (!!user.email && agent.email.toLowerCase() === user.email.toLowerCase()));
    // A member becomes featured only after an explicit successful agent save.
    // In particular, reading members must not recreate a deleted featured agent.
    if (index < 0) continue;
    const old = next[index];
    const updated = normalize({ ...old, user_id: user.id, name: user.full_name || old.name,
      phone: user.phone ?? old.phone, email: user.email ?? old.email, line_id: user.line_id ?? old.line_id,
      facebook: user.facebook ?? old.facebook, photo_url: user.avatar_url ?? old.photo_url, bio: user.bio ?? old.bio,
      rank: user.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า' });
    next[index] = updated;
  }
  return publish(next);
}

export async function updateAgent(agentId: string, updatedFields: Partial<ExtendedAgent>): Promise<ExtendedAgent[]> {
  const current = getAgents();
  const index = current.findIndex(agent => agent.id === agentId);
  const updated = normalize({ ...(index >= 0 ? current[index] : {}), ...updatedFields, id: agentId });
  validate(updated);
  const next = [...current];
  if (index >= 0) next[index] = updated;
  else next.push(updated);
  if (dataBackend === 'local') localWrite(next);
  else await persistAgent(updated);
  return publish(next);
}

export async function deleteAgent(agentId: string): Promise<ExtendedAgent[]> {
  requireConnection();
  if (!agentId || agentId.length > 120 || agentId.includes('/')) throw new Error('รหัสนายหน้าไม่ถูกต้อง');
  if (dataBackend === 'firebase') await deleteDoc(doc(db!, 'agents', agentId));
  else if (dataBackend === 'supabase') {
    const { data, error } = await supabase!.from('agents').delete().eq('id', agentId).select('id');
    if (error) throw error;
    if (!data?.some(row => row.id === agentId)) throw new Error('ลบนายหน้าไม่สำเร็จ กรุณาตรวจสอบสิทธิ์');
  }
  const next = getAgents().filter(agent => agent.id !== agentId);
  if (dataBackend === 'local') localWrite(next);
  return publish(next);
}
