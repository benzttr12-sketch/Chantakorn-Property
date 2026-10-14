import { Agent } from "@/lib/types";

export interface ExtendedAgent extends Agent {
  specialty: string;
  zone: string;
  experienceYears: number;
  closedDeals: number;
  rating: number;
  languages: string[];
}

/** Company contact when a listing has no assigned advisor. */
export const DEFAULT_AGENT: Agent = {
  id: 'chantakorn-team',
  name: 'ทีมฉันทากร พร็อพเพอร์ตี้',
  title: 'ทีมที่ปรึกษาอสังหาริมทรัพย์',
  phone: '081-604-0097',
  line_id: '@930xzcyi',
  facebook: 'https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/',
  email: 'contact@chantakornproperty.com',
  photo_url: '',
  bio: 'ติดต่อทีมงานเพื่อสอบถามข้อมูลทรัพย์และนัดชมสถานที่จริง',
};
