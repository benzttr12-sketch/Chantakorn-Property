export interface LocationItem {
  id: string;
  name: string;
  nameEn: string;
  district: string;
  image: string;
  propertyCount: number;
  description: string;
}

export interface SongkhlaDistrictInfo {
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  subdistricts: string[];
}

// ข้อมูลอำเภอและตำบลทั้งหมด 16 อำเภอ 127 ตำบล ในจังหวัดสงขลา
export const SONGKHLA_DISTRICTS: Record<string, SongkhlaDistrictInfo> = {
  "หาดใหญ่": {
    name: "หาดใหญ่",
    nameEn: "Hat Yai",
    lat: 7.0084,
    lng: 100.4705,
    subdistricts: [
      "หาดใหญ่",
      "ควนลัง",
      "คลองแห",
      "คอหงส์",
      "บ้านพรุ",
      "ทุ่งใหญ่",
      "ท่าข้าม",
      "ทุ่งตำเสา",
      "พะตง",
      "ฉลุง",
      "คลองอู่ตะเภา",
      "น้ำน้อย",
      "คูเต่า"
    ]
  },
  "เมืองสงขลา": {
    name: "เมืองสงขลา",
    nameEn: "Mueang Songkhla",
    lat: 7.1756,
    lng: 100.6141,
    subdistricts: [
      "บ่อยาง",
      "เขารูปช้าง",
      "เกาะแต้ว",
      "พะวง",
      "ทุ่งหวัง",
      "เกาะยอ"
    ]
  },
  "สะเดา": {
    name: "สะเดา",
    nameEn: "Sadao",
    lat: 6.6348,
    lng: 100.4243,
    subdistricts: [
      "สะเดา",
      "ปริก",
      "พังลา",
      "สำนักแต้ว",
      "ทุ่งหมอ",
      "ท่าโพธิ์",
      "ปาดังเบซาร์",
      "สำนักขาม",
      "เขามีเกียรติ"
    ]
  },
  "จะนะ": {
    name: "จะนะ",
    nameEn: "Chana",
    lat: 6.9147,
    lng: 100.7416,
    subdistricts: [
      "จะนะ",
      "จะโหนง",
      "ป่าชิง",
      "สะพานไม้แก่น",
      "สะกอม",
      "นาทับ",
      "นาวัง",
      "น้ำขาว",
      "ขุนตัดหวาย",
      "ท่าหมอไทร",
      "บ้านนา",
      "ตลิ่งชัน",
      "คู",
      "แค"
    ]
  },
  "นาทวี": {
    name: "นาทวี",
    nameEn: "Na Thawi",
    lat: 6.7337,
    lng: 100.6908,
    subdistricts: [
      "นาทวี",
      "ฉลอง",
      "ทับช้าง",
      "สะท้อน",
      "คลองทราย",
      "ปลักหนู",
      "ท่าประดู่",
      "วังใหญ่",
      "คลองกวาง",
      "ประกอบ"
    ]
  },
  "เทพา": {
    name: "เทพา",
    nameEn: "Thepha",
    lat: 6.8291,
    lng: 100.9634,
    subdistricts: [
      "เทพา",
      "ปากบาง",
      "เกาะสะบ้า",
      "ลำไพล",
      "ท่าม่วง",
      "วังใหญ่",
      "สะกอม"
    ]
  },
  "สะบ้าย้อย": {
    name: "สะบ้าย้อย",
    nameEn: "Saba Yoi",
    lat: 6.6152,
    lng: 100.9528,
    subdistricts: [
      "สะบ้าย้อย",
      "ทุ่งพอ",
      "เปียน",
      "เขาแดง",
      "คูหา",
      "จะแหน",
      "บาโหย",
      "ธารคีรี",
      "บ้านโหนด"
    ]
  },
  "ระโนด": {
    name: "ระโนด",
    nameEn: "Ranot",
    lat: 7.7774,
    lng: 100.3228,
    subdistricts: [
      "ระโนด",
      "คลองแดน",
      "ตะเครียะ",
      "ท่าบอน",
      "บ้านราม",
      "บ่อตรุ",
      "ปากแตระ",
      "พังยาง",
      "ระวะ",
      "สงโหนด",
      "บ้านใหม่",
      "แดนสงวน"
    ]
  },
  "สทิงพระ": {
    name: "สทิงพระ",
    nameEn: "Sathing Phra",
    lat: 7.4727,
    lng: 100.4414,
    subdistricts: [
      "จะทิ้งพระ",
      "กระดังงา",
      "คลองรี",
      "คูขุด",
      "ท่าหิน",
      "ชุมพล",
      "ดีหลวง",
      "บ่อแดง",
      "บ่อผาสุก",
      "วัดจันทร์",
      "สนามชัย"
    ]
  },
  "สิงหนคร": {
    name: "สิงหนคร",
    nameEn: "Singhanakhon",
    lat: 7.2345,
    lng: 100.5601,
    subdistricts: [
      "ชิงโค",
      "สทิงหม้อ",
      "ทำนบ",
      "รำแดง",
      "วัดขนุน",
      "ชะแล้",
      "ปากรอ",
      "ป่าขาด",
      "หัวเขา",
      "ม่วงงาม",
      "บางเขียด"
    ]
  },
  "รัตภูมิ": {
    name: "รัตภูมิ",
    nameEn: "Rattaphum",
    lat: 7.1352,
    lng: 100.2798,
    subdistricts: [
      "กำแพงเพชร",
      "ท่าชะมวง",
      "ควนรู",
      "คูหาใต้",
      "เขาพระ"
    ]
  },
  "บางกล่ำ": {
    name: "บางกล่ำ",
    nameEn: "Bang Klam",
    lat: 7.0864,
    lng: 100.4192,
    subdistricts: [
      "บางกล่ำ",
      "ท่าช้าง",
      "แม่ทอม",
      "บ้านหาร"
    ]
  },
  "คลองหอยโข่ง": {
    name: "คลองหอยโข่ง",
    nameEn: "Khlong Hoi Khong",
    lat: 6.9048,
    lng: 100.3752,
    subdistricts: [
      "คลองหอยโข่ง",
      "ทุ่งลาน",
      "โคกม่วง",
      "คลองรำพึง"
    ]
  },
  "ควนเนียง": {
    name: "ควนเนียง",
    nameEn: "Khuan Niang",
    lat: 7.1852,
    lng: 100.3541,
    subdistricts: [
      "รัตภูมิ",
      "ควนโส",
      "ห้วยลึก",
      "บางเหรียง"
    ]
  },
  "นาหม่อม": {
    name: "นาหม่อม",
    nameEn: "Na Mom",
    lat: 6.9582,
    lng: 100.5562,
    subdistricts: [
      "นาหม่อม",
      "พิจิตร",
      "ทุ่งขมิ้น",
      "คลองหรัง"
    ]
  },
  "กระแสสินธุ์": {
    name: "กระแสสินธุ์",
    nameEn: "Krasae Sin",
    lat: 7.6089,
    lng: 100.3441,
    subdistricts: [
      "กระแสสินธุ์",
      "เชิงแส",
      "เกาะใหญ่",
      "โรง"
    ]
  }
};

// รายชื่ออำเภอทั้งหมด 16 อำเภอในสงขลา
export const DISTRICTS_LIST = Object.keys(SONGKHLA_DISTRICTS);

// ฟังก์ชันดึงรายชื่อตำบลตามอำเภอ
export function getSongkhlaSubdistricts(district: string): string[] {
  if (!district) return [];
  const found = SONGKHLA_DISTRICTS[district];
  if (found) return found.subdistricts;
  // If user searched for partial match
  const matchedKey = Object.keys(SONGKHLA_DISTRICTS).find(k => k.includes(district) || district.includes(k));
  return matchedKey ? SONGKHLA_DISTRICTS[matchedKey].subdistricts : [];
}

// ฟังก์ชันดึงพิกัดโดยประมาณของอำเภอ/ตำบล เพื่อกรอกแผนที่ให้อัตโนมัติ
export function getSongkhlaCoordinates(district: string, _subdistrict?: string): { lat: number; lng: number } {
  const found = SONGKHLA_DISTRICTS[district];
  if (found) {
    return { lat: found.lat, lng: found.lng };
  }
  // Default to Hat Yai center
  return { lat: 7.0084, lng: 100.4705 };
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
    id: "sadao-border",
    name: "สะเดา",
    nameEn: "Sadao & Danok",
    district: "สะเดา",
    image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80",
    propertyCount: 28,
    description: "เมืองหน้าด่านชายแดนไทย-มาเลเซีย ศูนย์กลางเขตเศรษฐกิจพิเศษและการค้าชายแดน"
  },
  {
    id: "khuan-lang",
    name: "ควนลัง (หาดใหญ่)",
    nameEn: "Khuan Lang",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    propertyCount: 42,
    description: "โซนขยายตัวยอดนิยม ใกล้สนามบินนานาชาติหาดใหญ่ เดินทางสะดวกรวดเร็ว"
  },
  {
    id: "khlong-hae",
    name: "คลองแห (หาดใหญ่)",
    nameEn: "Khlong Hae",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
    propertyCount: 29,
    description: "ทำเลเชื่อมต่อถนนลพบุรีราเมศวร์ ชุมชนน่าอยู่ ใกล้ตลาดน้ำคลองแห"
  },
  {
    id: "ban-phru",
    name: "บ้านพรุ (หาดใหญ่)",
    nameEn: "Ban Phru",
    district: "หาดใหญ่",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
    propertyCount: 24,
    description: "บรรยากาศร่มรื่น เหมาะแก่การอยู่อาศัยของครอบครัว ใกล้ ม.หาดใหญ่"
  },
  {
    id: "singhanakhon",
    name: "สิงหนคร",
    nameEn: "Singhanakhon",
    district: "สิงหนคร",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    propertyCount: 19,
    description: "ทำเลข้ามสะพานติณสูลานนท์ ท่าเรือน้ำลึกสงขลา และชุมชนชายฝั่งทะเลอ่าวไทย"
  },
  {
    id: "rattaphum",
    name: "รัตภูมิ",
    nameEn: "Rattaphum",
    district: "รัตภูมิ",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
    propertyCount: 15,
    description: "ประตูสู่ฝั่งอันดามัน เชื่อมต่อพัทลุงและสตูล อากาศบริสุทธิ์และสวนเกษตรกรรม"
  }
];
