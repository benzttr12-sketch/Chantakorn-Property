# แผนการ Cutover ข้อมูลทรัพย์ขึ้น Cloudflare D1/R2 (ฉบับดำเนินการ)

เอกสารนี้สรุปสถานะปัจจุบันของการย้ายระบบ และขั้นตอนที่เหลือเพื่อใช้ Cloudflare D1/R2
เป็นฐานข้อมูลแคตตาล็อกทรัพย์หลักของ production โดย Firebase ยังคงดูแลระบบสมาชิก
(Auth), ลูกค้าสอบถาม (inquiries) และ LINE ตามสถาปัตยกรรมเดิม

## สถานะปัจจุบัน (2026-10-25)

| ส่วน | สถานะ |
|---|---|
| โค้ด Worker D1/R2 (PR #35–#67) | ✅ รวม main ครบ, CI เขียว |
| Staging Worker + D1 + R2 (dev) | ✅ รันจริง, flags เปิดเขียน/เผยแพร่/อัปโหลด/สวีป |
| ข้อมูลทรัพย์ 3 รายการ + รูป 15 ใบ | ✅ import เข้า D1/R2 แล้ว (พร้อม audit events) |
| นายหน้า (agents) ใน D1 | ✅ ลงทะเบียนจาก profiles แล้ว |
| เว็บ GitHub Pages | ✅ ใช้ D1 catalog + Firebase auth (ผ่านการทดสอบเต็มวงจร) |
| Vercel production (chantakornproperty.com) | ⏳ ยังอ่านทรัพย์จาก Firestore (โค้ดพร้อมเปลี่ยนด้วย env เดียว) |
| การทดสอบเต็มวงจรผ่าน UI จริง | ✅ login → สร้าง → อัปโหลดรูป (upload session + R2) → publish → โผล่หน้าเว็บสาธารณะ |

## หลักการสำคัญ

1. **Firebase Auth / inquiries / LINE ไม่ย้าย** — โครงสร้างนี้ถูกออกแบบให้สมาชิกและข้อมูลลูกค้า
   อยู่กับ Firebase ต่อไป มีเพียง "แคตตาล็อกทรัพย์" ที่ย้ายไป D1/R2
2. **ทุกการเปลี่ยน env ย้อนกลับได้ทันที** — การ rollback = ตั้งค่า env กลับเป็น firebase
   และข้อมูล Firestore ยังอยู่ครบ (ห้ามลบ/ห้ามหยุดเขียน Firestore จนกว่า cutover จะเสถียร)
3. **เผยแพร่ทีละขั้น** — ทดสอบกับเว็บ static ก่อน (ทำแล้ว) แล้วค่อยสลับ production หลัก

## ขั้นตอนที่เหลือ

### ขั้น 1 — เตรียมข้อมูลให้ตรงกัน (สำคัญที่สุด)
- [ ] ตรวจทรัพย์ใน Firestore vs D1 ให้จำนวน/เนื้อหาตรงกัน (ตอนนี้ 3 = 3 แล้ว)
- [ ] กำหนด "ช่วงหยุดแก้ไข" (freeze window) สั้น ๆ เช่น 1 ชั่วโมง ก่อนสลับ
      ระหว่างนั้นงดแก้ไขทรัพย์บน Firestore แล้ว import รายการที่หายไปอีกครั้ง
      (ใช้สคริปต์ import เดิมซึ่งทำงานได้แล้ว: สร้าง row + re-encode รูป + audit)

### ขั้น 2 — สร้างสภาพแวดล้อม production ของ Cloudflare
- [ ] สร้าง D1 `chantakorn-property-prod` + R2 `chantakorn-property-media-prod`
      / `chantakorn-inquiry-private-prod` (แยกจาก dev เด็ดขาด)
- [ ] สร้าง Worker production (ชื่อเช่น `chantakorn-property-api`) พร้อม custom domain
      เช่น `api.chantakornproperty.com` + secret `FIREBASE_WEB_API_KEY`
- [ ] ตั้ง `ALLOWED_ORIGIN` ของ prod = โดเมนเว็บจริง (อนุญาตหลายโดเมนได้ด้วย comma)
- [ ] ตั้งค่า flags บน prod: เปิดเฉพาะที่จำเป็น — แนะนำเริ่มด้วย
      `PROPERTY_WRITES_ENABLED/PUBLICATION/MEDIA_WRITES/MEDIA_UPLOAD_SESSIONS_REQUIRED=true`,
      `MEDIA_SWEEP_ENABLED=true`, `PUBLIC_CATALOG_CACHE_ENABLED=true`
- [ ] ใช้ `wrangler.jsonc` แบบ production (มีตัวอย่างใน
      `services/cloudflare-api/wrangler.production.example.jsonc`) — deploy ด้วยมือเท่านั้น
      (ยังไม่ automate ผ่าน CI จนกว่าจะมั่นใจ)

### ขั้น 3 — ทดสอบ prod แบบไร้ความเสี่ยง
- [ ] ยิง `/health`, `/v1/properties` ของ Worker prod
- [ ] import ทรัพย์จาก Firestore เข้า D1 prod + ตรวจรูปโหลดจาก R2 prod ครบ
- [ ] ทดสอบ admin เต็มวงจรบน prod ด้วยบัญชี ADMIN จริง (เหมือนที่ทำกับ staging สำเร็จแล้ว)

### ขั้น 4 — สลับ production (Vercel)
- [ ] บน Vercel ตั้ง env ของ production:
      `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=cloudflare`
      `NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN=https://api.chantakornproperty.com`
- [ ] Redeploy แล้วตรวจหน้าเว็บ/หน้าแอดมิน/รูปทุกหน้า
- [ ] **Rollback ทันทีได้**: เปลี่ยน env กลับ `firebase` + redeploy (ข้อมูล Firestore ยังครบ)

### ขั้น 5 — ระยะสังเกต (อย่างน้อย 1–2 สัปดาห์)
- [ ] เฝ้าดู errors/latency ของ Worker (Cloudflare dashboard)
- [ ] เก็บ backup D1 สม่ำเสมอ (`wrangler d1 export`)
- [ ] หลังมั่นใจ: ปิดการเขียนทรัพย์ลง Firestore (แจ้งทีมให้ใช้แอดมินบน D1 เท่านั้น)
      แล้วจึงจัดเก็บ/ลบข้อมูลทรัพย์เดิมใน Firestore ภายหลังตามนโยบาย backup

## สิ่งที่ยังค้าง (ไม่บังคับก่อน cutover)
- สมาชิก/โปรไฟล์บนเว็บ static กับ Vercel ใช้ Firestore ชุดเดียวกันอยู่แล้ว (ไม่ต้องทำอะไร)
- ระบบนับผู้ชมสถิติ/ประวัติการลงงานเฟส (work_jobs) ยังอยู่บน Firestore — ไม่เกี่ยวกับ cutover
- PR เก่า 6 รายการปิดหมดแล้ว
