'use client';

import { db } from '@/lib/firebase/client';
import { supabase } from '@/lib/supabase/client';
import { dataBackend } from '@/lib/backend';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { collection, getDocsFromServer, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';

export interface Review {
  id: string;
  customerName: string;
  customerRole: string;
  propertyTitleOrZone: string;
  agentName: string;
  rating: number;
  comment: string;
  date: string;
  avatarUrl?: string;
  verifiedBuyer: boolean;
  serviceType: 'buy' | 'sell' | 'rent' | 'consignment';
  published: boolean;
}
const STORAGE_KEY = 'chantakorn_customer_reviews_v1';
let cachedReviews: Review[] = [];
let publishedReviews: Review[] = [];

function normalizeReview(value: Review): Review {
  const review: Review = {
    id: String(value.id || '').trim(), customerName: String(value.customerName || '').trim(),
    customerRole: String(value.customerRole || '').trim(), propertyTitleOrZone: String(value.propertyTitleOrZone || '').trim(),
    agentName: String(value.agentName || '').trim(), rating: Number(value.rating), comment: String(value.comment || '').trim(),
    date: String(value.date || '').trim(), avatarUrl: String(value.avatarUrl || '').trim(),
    verifiedBuyer: value.verifiedBuyer === true, serviceType: value.serviceType, published: value.published === true,
  };
  const limits = { id: 120, customerName: 120, customerRole: 250, propertyTitleOrZone: 250, agentName: 150, comment: 4000, date: 40, avatarUrl: 2000 } as const;
  for (const [key, max] of Object.entries(limits)) {
    if ((review[key as keyof typeof limits] || '').length > max) throw new Error('ข้อมูลรีวิวยาวเกินกำหนด');
  }
  if (!review.id || review.id.includes('/') || !review.customerName || !review.comment || !review.date || !Number.isFinite(review.rating) || review.rating < 1 || review.rating > 5 || !['buy', 'sell', 'rent', 'consignment'].includes(review.serviceType)) throw new Error('กรุณาตรวจชื่อ ข้อความ วันที่ และคะแนนรีวิว');
  if (review.avatarUrl && !/^https:\/\//i.test(review.avatarUrl)) throw new Error('รูปโปรไฟล์ต้องใช้ URL ที่ขึ้นต้นด้วย https://');
  return review;
}
function readLocal(): Review[] {
  if (typeof window === 'undefined') return [];
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('ไม่สามารถอ่านรายการรีวิวที่เก็บไว้ได้');
  return parsed.map(normalizeReview);
}
function cache(reviews: Review[], includeDrafts = true) {
  if (includeDrafts) cachedReviews = reviews;
  publishedReviews = reviews.filter(review => review.published);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('chantakorn_reviews_updated', { detail: reviews }));
  return reviews;
}
export function getReviews(includeDrafts = false): Review[] {
  const reviews = dataBackend === 'local' ? readLocal() : includeDrafts ? cachedReviews : publishedReviews;
  return includeDrafts ? [...reviews] : reviews.filter(review => review.published);
}
/** Cloud reads never fall back to browser storage or example testimonials. */
export async function fetchReviews(includeDrafts = false): Promise<Review[]> {
  let reviews: Review[];
  if (dataBackend === 'firebase') {
    if (!db) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูลรีวิว');
    const source = collection(db, 'reviews');
    const snapshot = await getDocsFromServer(includeDrafts ? source : query(source, where('published', '==', true)));
    reviews = snapshot.docs.map(item => normalizeReview({ ...item.data(), id: item.id } as Review));
  } else if (dataBackend === 'supabase') {
    if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูลรีวิว');
    const source = supabase.from('reviews').select('id,published,data');
    const result = await (includeDrafts ? source : source.eq('published', true));
    if (result.error) throw new Error('โหลดรีวิวไม่สำเร็จ กรุณาลองใหม่');
    reviews = (result.data || []).map(item => normalizeReview({ ...item.data, id: item.id, published: item.published }));
  } else reviews = readLocal();
  cache(reviews, includeDrafts);
  return includeDrafts ? reviews : reviews.filter(review => review.published);
}
async function requireStaff() {
  const user = await getCurrentUserProfile();
  if (!user || !['ADMIN', 'AGENT'].includes(user.role)) throw new Error('กรุณาเข้าสู่ระบบเจ้าหน้าที่เพื่อจัดการรีวิว');
}
async function persist(review: Review): Promise<void> {
  if (dataBackend === 'firebase') {
    if (!db) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูลรีวิว');
    await setDoc(doc(db, 'reviews', review.id), review);
  } else if (dataBackend === 'supabase') {
    if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูลรีวิว');
    const { data, error } = await supabase.from('reviews').upsert({ id: review.id, published: review.published, data: review }).select('id');
    if (error || !data?.some(item => item.id === review.id)) throw new Error('บันทึกรีวิวไม่สำเร็จ กรุณาลองใหม่');
  } else {
    if (typeof window === 'undefined') throw new Error('ไม่สามารถบันทึกรีวิวในเครื่องได้');
    const current = readLocal().filter(item => item.id !== review.id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([review, ...current]));
  }
}
export async function addReview(input: Omit<Review, 'id' | 'date' | 'published'> & { date?: string; published?: boolean }): Promise<Review[]> {
  await requireStaff();
  const review = normalizeReview({ ...input, id: `rev-${crypto.randomUUID()}`, date: input.date || new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()), published: input.published === true });
  await persist(review);
  return cache([review, ...getReviews(true).filter(item => item.id !== review.id)]);
}
export async function updateReview(id: string, fields: Partial<Review>): Promise<Review[]> {
  await requireStaff();
  const current = getReviews(true);
  const existing = current.find(item => item.id === id);
  if (!existing) throw new Error('ไม่พบรีวิว กรุณาโหลดรายการใหม่');
  const review = normalizeReview({ ...existing, ...fields, id });
  await persist(review);
  return cache(current.map(item => item.id === id ? review : item));
}
export async function deleteReview(id: string): Promise<Review[]> {
  await requireStaff();
  const current = getReviews(true);
  if (dataBackend === 'firebase') {
    if (!db) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูลรีวิว');
    await deleteDoc(doc(db, 'reviews', id));
  } else if (dataBackend === 'supabase') {
    if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูลรีวิว');
    const { data, error } = await supabase.from('reviews').delete().eq('id', id).select('id');
    if (error || !data?.some(item => item.id === id)) throw new Error('ลบรีวิวไม่สำเร็จ กรุณาลองใหม่');
  } else {
    if (typeof window === 'undefined') throw new Error('ไม่สามารถบันทึกรีวิวในเครื่องได้');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter(item => item.id !== id)));
  }
  return cache(current.filter(item => item.id !== id));
}
