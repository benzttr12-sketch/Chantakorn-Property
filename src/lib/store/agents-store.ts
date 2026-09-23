'use client';

import { ExtendedAgent, AGENTS as DEFAULT_AGENTS } from '@/data/agents';

const STORAGE_KEY = 'chantakorn_custom_agents_v1';

export function getAgents(): ExtendedAgent[] {
  if (typeof window === 'undefined') {
    return DEFAULT_AGENTS;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse agents from storage:', err);
  }
  return DEFAULT_AGENTS;
}

export function saveAgents(agents: ExtendedAgent[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: agents }));
  } catch (err) {
    console.error('Failed to save agents to storage:', err);
  }
}

export function resetAgentsToDefault(): ExtendedAgent[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('chantakorn_agents_updated', { detail: DEFAULT_AGENTS }));
  }
  return DEFAULT_AGENTS;
}

export function updateAgent(agentId: string, updatedFields: Partial<ExtendedAgent>): ExtendedAgent[] {
  const current = getAgents();
  const index = current.findIndex((a) => a.id === agentId);
  if (index >= 0) {
    current[index] = { ...current[index], ...updatedFields };
  } else {
    // If not found, add
    current.push({
      id: agentId,
      name: updatedFields.name || 'นายหน้าใหม่',
      rank: updatedFields.rank || 'นายหน้า',
      title: updatedFields.title || 'ที่ปรึกษาอสังหาริมทรัพย์',
      phone: updatedFields.phone || '081-604-0097',
      line_id: updatedFields.line_id || '@chantakorn',
      email: updatedFields.email || 'contact@chantakornproperty.com',
      photo_url: updatedFields.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
      bio: updatedFields.bio || '',
      specialty: updatedFields.specialty || '',
      zone: updatedFields.zone || 'หาดใหญ่ - สงขลา',
      experienceYears: updatedFields.experienceYears || 1,
      closedDeals: updatedFields.closedDeals || 10,
      rating: updatedFields.rating || 5.0,
      languages: updatedFields.languages || ['ไทย'],
      ...updatedFields,
    });
  }
  saveAgents(current);
  return current;
}

export function deleteAgent(agentId: string): ExtendedAgent[] {
  const current = getAgents();
  const filtered = current.filter((a) => a.id !== agentId);
  saveAgents(filtered);
  return filtered;
}
