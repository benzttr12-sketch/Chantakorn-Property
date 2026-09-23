'use client';

import { Property } from '@/lib/types';
import { getLocalProperties } from '@/lib/store/properties-store';

const STORAGE_KEY = 'chantakorn_compare_ids';
const MAX_COMPARE = 4;

export function getCompareIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCompareIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('compare-updated', { detail: ids }));
  } catch (err) {
    console.error('Failed to save compare ids', err);
  }
}

export function toggleCompareId(id: string): { added: boolean; list: string[]; message?: string } {
  const current = getCompareIds();
  const exists = current.includes(id);

  if (exists) {
    const next = current.filter((x) => x !== id);
    saveCompareIds(next);
    return { added: false, list: next };
  }

  if (current.length >= MAX_COMPARE) {
    return {
      added: false,
      list: current,
      message: `สามารถเลือกเปรียบเทียบได้สูงสุด ${MAX_COMPARE} รายการพร้อมกัน`,
    };
  }

  const next = [...current, id];
  saveCompareIds(next);
  return { added: true, list: next };
}

export function clearCompareList() {
  saveCompareIds([]);
}

export function getCompareProperties(allProperties?: Property[]): Property[] {
  const ids = getCompareIds();
  if (ids.length === 0) return [];
  const source = allProperties && allProperties.length > 0 ? allProperties : getLocalProperties();
  return ids
    .map((id) => source.find((p) => p.id === id))
    .filter((p): p is Property => Boolean(p));
}
