import { Agent } from "@/lib/types";

export interface ExtendedAgent extends Agent {
  specialty: string;
  zone: string;
  experienceYears: number;
  closedDeals: number;
  rating: number;
  languages: string[];
}

export const AGENTS: ExtendedAgent[] = [
  {
    id: "a1111111-1111-1111-1111-111111111111",
    name: "คุณฉันทากร นวลจันทร์ (เบนซ์)",
    rank: "แอดมิน",
    title: "กรรมการผู้จัดการ & หัวหน้าฝ่ายที่ปรึกษา",
    phone: "081-604-0097",
    line_id: "LINE Official Account",
    facebook: "https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/",
    email: "chantakorn@chantakornproperty.com",
    photo_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80",
    bio: "ผู้บริหารและที่ปรึกษาอสังหาริมทรัพย์ Chantakorn Property ประสบการณ์ในพื้นที่หาดใหญ่–สงขลากว่า 10 ปี เชี่ยวชาญการประเมินราคา การเจรจาต่อรอง และการประสานงานสินเชื่อธนาคาร ดูแลลูกค้าทุกท่านอย่างซื่อตรงและโปร่งใส",
    specialty: "อสังหาฯ พรีเมียม, ธุรกรรมขายฝาก, นิติกรรมสัญญา",
    zone: "ทั่วหาดใหญ่ – สงขลา",
    experienceYears: 10,
    closedDeals: 180,
    rating: 5.0,
    languages: ["ไทย", "English"],
  },
  {
    id: "a2222222-2222-2222-2222-222222222222",
    name: "คุณกมลวรรณ (แนน) – ทีมงานที่ปรึกษา ม.อ.-คอหงส์",
    rank: "นายหน้า",
    title: "ที่ปรึกษาอาวุโส ประจำโซน ม.อ.",
    phone: "081-604-0097",
    line_id: "LINE Official Account",
    facebook: "https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/",
    email: "nan@chantakornproperty.com",
    photo_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
    bio: "ผู้เชี่ยวชาญคอนโดและทาวน์โฮมทำเลรอบมหาวิทยาลัยสงขลานครินทร์ (ม.อ.) และคอหงส์ แม่นยำด้านผลตอบแทนการปล่อยเช่าสำหรับนักลงทุนและการเลือกบ้านพักอาศัยของบุคลากรทางการแพทย์",
    specialty: "คอนโดใกล้มหาวิทยาลัย, ทาวน์โฮม, การลงทุนปล่อยเช่า",
    zone: "โซน ม.อ. – คอหงส์ – ปุณณกัณฑ์",
    experienceYears: 6,
    closedDeals: 95,
    rating: 4.9,
    languages: ["ไทย", "English"],
  },
  {
    id: "a3333333-3333-3333-3333-333333333333",
    name: "คุณธนภัทร (ตั้ม) – ผู้เชี่ยวชาญที่ดินและโครงการบ้าน",
    rank: "นายหน้า",
    title: "ผู้เชี่ยวชาญที่ดิน & บ้านเดี่ยว",
    phone: "081-604-0097",
    line_id: "LINE Official Account",
    facebook: "https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/",
    email: "tum@chantakornproperty.com",
    photo_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80",
    bio: "เชี่ยวชาญการประเมินราคาที่ดินเปล่า แปลงใหญ่สร้างบ้าน โกดังสินค้า และบ้านเดี่ยวโซนสนามบิน คลองแห และลพบุรีราเมศวร์ พร้อมให้คำปรึกษาการตรวจสอบผังเมืองและเอกสารสิทธิ์",
    specialty: "ที่ดินจัดสรร, บ้านเดี่ยว, อาคารพาณิชย์, ตรวจผังเมือง",
    zone: "โซนสนามบิน – คลองแห – เมืองสงขลา",
    experienceYears: 8,
    closedDeals: 120,
    rating: 4.9,
    languages: ["ไทย"],
  }
];

export const DEFAULT_AGENT = AGENTS[0];
