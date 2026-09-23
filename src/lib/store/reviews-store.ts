'use client';

export interface Review {
  id: string;
  customerName: string;
  customerRole: string; // e.g. "ผู้ซื้อบ้านเดี่ยว โซนสนามบินหาดใหญ่"
  propertyTitleOrZone: string; // e.g. "บ้านเดี่ยว นวลจันทร์การ์เดนท์ สนามบิน"
  agentName: string; // e.g. "คุณฉันทากร (เบนซ์)"
  rating: number; // 1 - 5
  comment: string;
  date: string; // "15 ก.ย. 2026"
  avatarUrl?: string;
  verifiedBuyer: boolean;
  serviceType: 'buy' | 'sell' | 'rent' | 'consignment'; // ซื้อ, ขาย, เช่า, ขายฝาก
}

export const DEFAULT_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    customerName: 'นพ. วรพงศ์ รัตนชัย',
    customerRole: 'แพทย์ประจำ รพ.ม.อ. หาดใหญ่',
    propertyTitleOrZone: 'คอนโด The Rise Residence ม.อ. – ปุณณกัณฑ์',
    agentName: 'คุณกมลวรรณ (แนน)',
    rating: 5,
    comment: 'ประทับใจการบริการของคุณแนนมากครับ ให้ข้อมูลเชิงลึกเรื่องทำเลและช่วยประสานงานเรื่องเอกสารสินเชื่อกับธนาคารจนผ่านอย่างราบรื่น ได้ห้องสวย ทำเลเดินทางสะดวกใกล้ที่ทำงาน แนะนำ Chantakorn Property เลยครับ!',
    date: '18 ก.ย. 2026',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
    verifiedBuyer: true,
    serviceType: 'buy',
  },
  {
    id: 'rev-2',
    customerName: 'คุณพัชรินทร์ สมบูรณ์ทรัพย์',
    customerRole: 'เจ้าของธุรกิจร้านอาหาร หาดใหญ่',
    propertyTitleOrZone: 'อาคารพาณิชย์ 3 ชั้นครึ่ง โซนถนนศุภสารรังสรรค์',
    agentName: 'คุณฉันทากร (เบนซ์)',
    rating: 5,
    comment: 'ฝากขายตึกแถวกับคุณเบนซ์ไม่ถึง 2 เดือน ปิดการขายได้ราคาที่พอใจมากครับ ทีมงานช่วยทำการตลาดทั้งออนไลน์และพาลูกค้ากลุ่มเป้าหมายมาดูตึกจริง ทุกขั้นตอนสัญญาจะซื้อจะขายดูแลรอบคอบ ไม่มีปัญหาจุกจิกเลย',
    date: '10 ก.ย. 2026',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    verifiedBuyer: true,
    serviceType: 'sell',
  },
  {
    id: 'rev-3',
    customerName: 'คุณธวัชชัย & คุณนฤมล',
    customerRole: 'ครอบครัวเจ้าของบ้านใหม่',
    propertyTitleOrZone: 'บ้านเดี่ยว 2 ชั้น โซนสนามบิน – คลองหอยโข่ง',
    agentName: 'คุณธนภัทร (ตั้ม)',
    rating: 5,
    comment: 'คุณตั้มพาชมบ้านจริงอย่างใจเย็น ไม่กดดันเลยครับ ช่วยเช็คสภาพบ้านและระบบน้ำไฟให้อย่างละเอียด ก่อนวันโอนกรรมสิทธิ์ก็เตรียมเอกสารให้ครบถ้วน ขอบคุณทีมงาน Chantakorn ที่ช่วยให้เราได้บ้านในฝันครับ',
    date: '02 ก.ย. 2026',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    verifiedBuyer: true,
    serviceType: 'buy',
  },
  {
    id: 'rev-4',
    customerName: 'คุณศิริพร เลิศพาณิชย์',
    customerRole: 'นักลงทุนอสังหาริมทรัพย์ สงขลา',
    propertyTitleOrZone: 'ที่ดินแปลงสวย เหมาะจัดสรร โซนคลองแห – ลพบุรีราเมศวร์',
    agentName: 'คุณฉันทากร (เบนซ์)',
    rating: 5,
    comment: 'ปรึกษาเรื่องขายฝากและจัดหาที่ดินเพื่อพัฒนาโครงการ คุณเบนซ์มีความรู้ด้านผังเมืองหาดใหญ่และกฎหมายที่ดินแน่นมาก แนะนำข้อมูลตรงไปตรงมา เป็นนายหน้าที่ไว้วางใจได้ที่สุดในสงขลาค่ะ',
    date: '25 ส.ค. 2026',
    avatarUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80',
    verifiedBuyer: true,
    serviceType: 'consignment',
  },
];

const STORAGE_KEY = 'chantakorn_customer_reviews_v1';

export function getReviews(): Review[] {
  if (typeof window === 'undefined') {
    return DEFAULT_REVIEWS;
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
    console.error('Failed to parse reviews from storage:', err);
  }
  return DEFAULT_REVIEWS;
}

export function saveReviews(reviews: Review[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    window.dispatchEvent(new CustomEvent('chantakorn_reviews_updated', { detail: reviews }));
  } catch (err) {
    console.error('Failed to save reviews to storage:', err);
  }
}

export function addReview(newReview: Omit<Review, 'id' | 'date'> & { date?: string }): Review[] {
  const current = getReviews();
  const dateStr = newReview.date || new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  const created: Review = {
    ...newReview,
    id: `rev-${Date.now()}`,
    date: dateStr,
    verifiedBuyer: newReview.verifiedBuyer !== undefined ? newReview.verifiedBuyer : true,
  };

  const updated = [created, ...current];
  saveReviews(updated);
  return updated;
}

export function updateReview(reviewId: string, updatedFields: Partial<Review>): Review[] {
  const current = getReviews();
  const index = current.findIndex((r) => r.id === reviewId);
  if (index >= 0) {
    current[index] = { ...current[index], ...updatedFields };
    saveReviews(current);
  }
  return current;
}

export function deleteReview(reviewId: string): Review[] {
  const current = getReviews();
  const filtered = current.filter((r) => r.id !== reviewId);
  saveReviews(filtered);
  return filtered;
}

export function resetReviewsToDefault(): Review[] {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('chantakorn_reviews_updated', { detail: DEFAULT_REVIEWS }));
  }
  return DEFAULT_REVIEWS;
}
