// Derived from thailand-geography-json (MIT): https://github.com/thailand-geography-data/thailand-geography-json
// Province code 90 — Songkhla, 16 districts and 127 subdistricts.
export const SONGKHLA_ADDRESSES = [
  {
    "district": "เมืองสงขลา",
    "subdistricts": [
      "บ่อยาง",
      "เขารูปช้าง",
      "เกาะแต้ว",
      "พะวง",
      "ทุ่งหวัง",
      "เกาะยอ"
    ]
  },
  {
    "district": "สทิงพระ",
    "subdistricts": [
      "จะทิ้งพระ",
      "กระดังงา",
      "สนามชัย",
      "ดีหลวง",
      "ชุมพล",
      "คลองรี",
      "คูขุด",
      "ท่าหิน",
      "วัดจันทร์",
      "บ่อแดง",
      "บ่อดาน"
    ]
  },
  {
    "district": "จะนะ",
    "subdistricts": [
      "บ้านนา",
      "ป่าชิง",
      "สะพานไม้แก่น",
      "สะกอม",
      "นาหว้า",
      "นาทับ",
      "น้ำขาว",
      "ขุนตัดหวาย",
      "ท่าหมอไทร",
      "จะโหนง",
      "คู",
      "แค",
      "คลองเปียะ",
      "ตลิ่งชัน"
    ]
  },
  {
    "district": "นาทวี",
    "subdistricts": [
      "นาทวี",
      "ฉาง",
      "นาหมอศรี",
      "คลองทราย",
      "ปลักหนู",
      "ท่าประดู่",
      "สะท้อน",
      "ทับช้าง",
      "ประกอบ",
      "คลองกวาง"
    ]
  },
  {
    "district": "เทพา",
    "subdistricts": [
      "เทพา",
      "ปากบาง",
      "เกาะสะบ้า",
      "ลำไพล",
      "ท่าม่วง",
      "วังใหญ่",
      "สะกอม"
    ]
  },
  {
    "district": "สะบ้าย้อย",
    "subdistricts": [
      "สะบ้าย้อย",
      "ทุ่งพอ",
      "เปียน",
      "บ้านโหนด",
      "จะแหน",
      "คูหา",
      "เขาแดง",
      "บาโหย",
      "ธารคีรี"
    ]
  },
  {
    "district": "ระโนด",
    "subdistricts": [
      "ระโนด",
      "คลองแดน",
      "ตะเครียะ",
      "ท่าบอน",
      "บ้านใหม่",
      "บ่อตรุ",
      "ปากแตระ",
      "พังยาง",
      "ระวะ",
      "วัดสน",
      "บ้านขาว",
      "แดนสงวน"
    ]
  },
  {
    "district": "กระแสสินธุ์",
    "subdistricts": [
      "เกาะใหญ่",
      "โรง",
      "เชิงแส",
      "กระแสสินธุ์"
    ]
  },
  {
    "district": "รัตภูมิ",
    "subdistricts": [
      "กำแพงเพชร",
      "ท่าชะมวง",
      "คูหาใต้",
      "ควนรู",
      "เขาพระ"
    ]
  },
  {
    "district": "สะเดา",
    "subdistricts": [
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
  {
    "district": "หาดใหญ่",
    "subdistricts": [
      "หาดใหญ่",
      "ควนลัง",
      "คูเต่า",
      "คอหงส์",
      "คลองแห",
      "คลองอู่ตะเภา",
      "ฉลุง",
      "ทุ่งใหญ่",
      "ทุ่งตำเสา",
      "ท่าข้าม",
      "น้ำน้อย",
      "บ้านพรุ",
      "พะตง"
    ]
  },
  {
    "district": "นาหม่อม",
    "subdistricts": [
      "นาหม่อม",
      "พิจิตร",
      "ทุ่งขมิ้น",
      "คลองหรัง"
    ]
  },
  {
    "district": "ควนเนียง",
    "subdistricts": [
      "รัตภูมิ",
      "ควนโส",
      "ห้วยลึก",
      "บางเหรียง"
    ]
  },
  {
    "district": "บางกล่ำ",
    "subdistricts": [
      "บางกล่ำ",
      "ท่าช้าง",
      "แม่ทอม",
      "บ้านหาร"
    ]
  },
  {
    "district": "สิงหนคร",
    "subdistricts": [
      "ชิงโค",
      "สทิงหม้อ",
      "ทำนบ",
      "รำแดง",
      "วัดขนุน",
      "ชะแล้",
      "ปากรอ",
      "ป่าขาด",
      "หัวเขา",
      "บางเขียด",
      "ม่วงงาม"
    ]
  },
  {
    "district": "คลองหอยโข่ง",
    "subdistricts": [
      "คลองหอยโข่ง",
      "ทุ่งลาน",
      "โคกม่วง",
      "คลองหลา"
    ]
  }
] as const;

export const SONGKHLA_DISTRICTS = SONGKHLA_ADDRESSES.map((address) => address.district);

export function subdistrictsForSongkhlaDistrict(district: string): readonly string[] {
  return SONGKHLA_ADDRESSES.find((address) => address.district === district)?.subdistricts ?? [];
}
