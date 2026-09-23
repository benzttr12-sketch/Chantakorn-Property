'use client';

import { ExtendedAgent, AGENTS as DEFAULT_AGENTS } from '@/data/agents';
import { UserProfile } from '@/lib/types';
import { db } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  Firestore
} from 'firebase/firestore';

// In-memory runtime cache for seamless UI rendering
let inMemoryAgents: ExtendedAgent[] = [...DEFAULT_AGENTS];

export function getAgents(): ExtendedAgent[] {
  return inMemoryAgents;
}

/**
 * ดึงข้อมูลนายหน้าทั้งหมดจากคลาวด์ Firebase Firestore โดยตรง
 * ไม่ได้พึ่งพา Local Storage ในเครื่องคอมพิวเตอร์อย่างเดียว
 */
export async function fetchAgents(): Promise<ExtendedAgent[]> {
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    try {
      const snap = await getDocs(collection(firestore, 'agents'));
      if (!snap.empty) {
        const list: ExtendedAgent[] = snap.docs.map(d => ({
          ...d.data(),
          id: d.id,
        } as ExtendedAgent));
        inMemoryAgents = list;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: list }));
        }
        return list;
      } else {
        // Seeding default agents into Cloud Firestore
        try {
          const seedPromises = DEFAULT_AGENTS.map(agent => 
            setDoc(doc(firestore, 'agents', agent.id), JSON.parse(JSON.stringify(agent)))
          );
          await Promise.all(seedPromises);
        } catch (seedErr) {
          console.warn('Seed agents to Firestore warning:', seedErr);
        }
        inMemoryAgents = [...DEFAULT_AGENTS];
        return inMemoryAgents;
      }
    } catch (err) {
      console.warn('Fetch agents from Firestore warning:', err);
    }
  }
  return inMemoryAgents;
}

export async function saveAgentsToCloud(agents: ExtendedAgent[]): Promise<void> {
  inMemoryAgents = agents;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: agents }));
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    try {
      const promises = agents.map(a => 
        setDoc(doc(firestore, 'agents', a.id), JSON.parse(JSON.stringify(a)), { merge: true })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to save agents to Firestore:', err);
    }
  }
}

export function saveAgents(agents: ExtendedAgent[]): void {
  saveAgentsToCloud(agents).catch(console.error);
}

export function resetAgentsToDefault(): ExtendedAgent[] {
  inMemoryAgents = [...DEFAULT_AGENTS];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: inMemoryAgents }));
  }
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    try {
      DEFAULT_AGENTS.forEach(a => {
        setDoc(doc(firestore, 'agents', a.id), JSON.parse(JSON.stringify(a)), { merge: true }).catch(() => {});
      });
    } catch (err) {
      console.warn('Reset agents in cloud error:', err);
    }
  }
  return inMemoryAgents;
}

/**
 * ซิงก์ข้อมูลระหว่างตารางสมาชิก (Users/Profiles) กับระบบนายหน้าแนะนำ (Agents) อัตโนมัติในฐานข้อมูลคลาวด์
 */
export function syncAgentsFromUsers(users: UserProfile[]): ExtendedAgent[] {
  if (!Array.isArray(users)) return getAgents();
  
  const currentAgents = getAgents();
  let changed = false;
  const updatedAgents = [...currentAgents];

  users.forEach((user) => {
    const matchIndex = updatedAgents.findIndex((a) => 
      a.user_id === user.id ||
      a.id === user.id ||
      a.id === `agent-${user.id}` ||
      (user.email && a.email && a.email.toLowerCase() === user.email.toLowerCase()) ||
      a.name.trim() === user.full_name.trim()
    );

    if (matchIndex >= 0) {
      const existing = updatedAgents[matchIndex];
      const isDifferent = 
        (user.full_name && existing.name !== user.full_name) ||
        (user.phone && existing.phone !== user.phone) ||
        (user.email && existing.email !== user.email) ||
        (user.avatar_url && existing.photo_url !== user.avatar_url) ||
        (user.line_id && existing.line_id !== user.line_id) ||
        (user.facebook && existing.facebook !== user.facebook) ||
        (user.bio && existing.bio !== user.bio) ||
        existing.user_id !== user.id;

      if (isDifferent) {
        updatedAgents[matchIndex] = {
          ...existing,
          user_id: user.id,
          name: user.full_name || existing.name,
          phone: user.phone || existing.phone,
          email: user.email || existing.email,
          line_id: user.line_id || existing.line_id,
          facebook: user.facebook || existing.facebook,
          photo_url: user.avatar_url || existing.photo_url,
          bio: user.bio || existing.bio,
          rank: user.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า',
        };
        changed = true;
      }
    } else if (user.role === 'AGENT' || user.role === 'ADMIN') {
      updatedAgents.push({
        id: `agent-${user.id}`,
        user_id: user.id,
        name: user.full_name,
        rank: user.role === 'ADMIN' ? 'แอดมิน' : 'นายหน้า',
        title: user.role === 'ADMIN' ? 'ผู้บริหาร & ที่ปรึกษาอสังหาริมทรัพย์' : 'ที่ปรึกษาอสังหาริมทรัพย์มืออาชีพ',
        phone: user.phone || '081-604-0097',
        line_id: user.line_id || '@chantakorn',
        facebook: user.facebook || '',
        email: user.email || 'contact@chantakornproperty.com',
        photo_url: user.avatar_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
        bio: user.bio || 'พร้อมดูแลและให้คำปรึกษาการซื้อ-ขาย-เช่า-ขายฝาก อสังหาริมทรัพย์ในหาดใหญ่และสงขลาอย่างมืออาชีพ',
        specialty: 'บ้านเดี่ยว, คอนโด, ทาวน์โฮม, ที่ดิน',
        zone: 'โซนหาดใหญ่ – สงขลา',
        experienceYears: 3,
        closedDeals: 15,
        rating: 5.0,
        languages: ['ไทย', 'English'],
      });
      changed = true;
    }
  });

  if (changed) {
    saveAgents(updatedAgents);
  }
  return updatedAgents;
}

export function updateAgent(agentId: string, updatedFields: Partial<ExtendedAgent>): ExtendedAgent[] {
  const current = [...inMemoryAgents];
  const index = current.findIndex((a) => a.id === agentId);
  let finalAgent: ExtendedAgent;

  if (index >= 0) {
    current[index] = { ...current[index], ...updatedFields };
    finalAgent = current[index];
  } else {
    finalAgent = {
      id: agentId,
      user_id: updatedFields.user_id,
      name: updatedFields.name || 'นายหน้าใหม่',
      rank: updatedFields.rank || 'นายหน้า',
      title: updatedFields.title || 'ที่ปรึกษาอสังหาริมทรัพย์มืออาชีพ',
      phone: updatedFields.phone || '081-604-0097',
      line_id: updatedFields.line_id || '@chantakorn',
      facebook: updatedFields.facebook || '',
      email: updatedFields.email || 'contact@chantakornproperty.com',
      photo_url: updatedFields.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
      bio: updatedFields.bio || 'พร้อมดูแลและให้คำปรึกษาการซื้อ-ขาย-เช่า-ขายฝาก อสังหาริมทรัพย์ในหาดใหญ่และสงขลาอย่างมืออาชีพ',
      specialty: updatedFields.specialty || 'บ้านเดี่ยว, คอนโด, ที่ดิน',
      zone: updatedFields.zone || 'หาดใหญ่ - สงขลา',
      experienceYears: updatedFields.experienceYears || 3,
      closedDeals: updatedFields.closedDeals || 15,
      rating: updatedFields.rating || 5.0,
      languages: updatedFields.languages || ['ไทย'],
      ...updatedFields,
    };
    current.push(finalAgent);
  }

  inMemoryAgents = current;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: current }));
  }

  // Persist directly to Firebase Firestore in the Cloud
  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    setDoc(doc(firestore, 'agents', finalAgent.id), JSON.parse(JSON.stringify(finalAgent)), { merge: true }).catch((err) => {
      console.error('Failed to update agent in Firestore cloud:', err);
    });
  }

  return current;
}

export function deleteAgent(agentId: string): ExtendedAgent[] {
  const filtered = inMemoryAgents.filter((a) => a.id !== agentId);
  inMemoryAgents = filtered;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: filtered }));
  }

  const firestore: Firestore | null = db;
  if (dataBackend === 'firebase' && firestore) {
    deleteDoc(doc(firestore, 'agents', agentId)).catch((err) => {
      console.error('Failed to delete agent from Firestore cloud:', err);
    });
  }

  return filtered;
}
