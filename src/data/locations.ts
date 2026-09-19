export interface LocationItem {
  id: string;
  name: string;
  nameEn: string;
  district: string;
  image: string;
  propertyCount: number;
  description: string;
}

export const LOCATIONS: LocationItem[] = [
  {
    id: "hatyai-central",
    name: "หาดใหญ่",
    nameEn: "Hat Yai Downtown & Central",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    propertyCount: 85,
    description: "ศูนย์กลางเศรษฐกิจ การค้า และการศึกษา ใกล้ ม.อ. เซ็นทรัลหาดใหญ่ และย่านธุรกิจ"
  },
  {
    id: "mueang-songkhla",
    name: "เมืองสงขลา",
    nameEn: "Mueang Songkhla",
    district: "เมืองสงขลา",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    propertyCount: 38,
    description: "เมืองเก่าเสน่ห์ริมทะเล ใกล้หาดชลาทัศน์ แหลมสมิหลา และสถานที่ราชการ"
  },
  {
    id: "khuan-lang",
    name: "ควนลัง",
    nameEn: "Khuan Lang",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    propertyCount: 42,
    description: "โซนขยายตัวยอดนิยม ใกล้สนามบินนานาชาติหาดใหญ่ เดินทางสะดวกรวดเร็ว"
  },
  {
    id: "khlong-hae",
    name: "คลองแห",
    nameEn: "Khlong Hae",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
    propertyCount: 29,
    description: "ทำเลเชื่อมต่อถนนลพบุรีราเมศวร์ ชุมชนน่าอยู่ ใกล้ตลาดน้ำคลองแห"
  },
  {
    id: "ban-phru",
    name: "บ้านพรุ",
    nameEn: "Ban Phru",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
    propertyCount: 24,
    description: "บรรยากาศร่มรื่น เหมาะแก่การอยู่อาศัยของครอบครัว ใกล้ ม.หาดใหญ่"
  },
  {
    id: "thung-lung",
    name: "ทุ่งลุง",
    nameEn: "Thung Lung",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
    propertyCount: 16,
    description: "เส้นทางเชื่อมต่อสะเดา-มาเลเซีย ศักยภาพสูงด้านโลจิสติกส์และโรงงาน/โกดัง"
  }
];

export const DISTRICTS_LIST = [
  "หาดใหญ่",
  "เมืองสงขลา",
  "ควนลัง",
  "คลองแห",
  "บ้านพรุ",
  "ทุ่งลุง",
  "คอหงส์",
  "สิงหนคร"
];
