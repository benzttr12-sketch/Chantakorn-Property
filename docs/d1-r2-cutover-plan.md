# แผนการ Cutover ข้อมูลทรัพย์ขึ้น Cloudflare D1/R2 (ฉบับดำเนินการ)

> **ความคืบหน้า 2026-10-25:** ขั้น 1–3 เสร็จสมบูรณ์แล้ว production ทั้งชุดใช้งานจริงที่
> `https://chantakorn-property-api.chantakorn-property.workers.dev` (D1 `chantakorn-property-prod`,
> R2 `chantakorn-property-media-prod` / `chantakorn-inquiry-private-prod`) — เว็บ GitHub Pages
> สลับไปใช้ production Worker นี้แล้ว เหลือเพียงขั้น 4 ที่ต้องตั้งค่า 2 environment variables
> บน Vercel (ทำผ่าน dashboard เท่านั้น) และช่วงสังเกตในขั้น 5

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

### ขั้น 1 — เตรียมข้อมูลให้ตรงกัน (สำคัญที่สุด) ✅ 2026-10-25
- [x] Firestore (3 รายการ) กับ D1 (3 รายการ) ตรงกัน พร้อมรูปและ audit events
- [x] ช่วงหยุดแก้ไข: ทำการย้ายในคราวเดียวจบ ไม่มีการแก้ไขข้อมูลค้างระหว่างทาง

### ขั้น 2 — สร้างสภาพแวดล้อม production ของ Cloudflare ✅ 2026-10-25
- [x] D1 `chantakorn-property-prod` + R2 `chantakorn-property-media-prod`
      / `chantakorn-inquiry-private-prod` (แยกจาก dev เด็ดขาด)
- [x] Worker production `chantakorn-property-api` ที่
      `https://chantakorn-property-api.chantakorn-property.workers.dev`
      + secret `FIREBASE_WEB_API_KEY`
- [x] `ALLOWED_ORIGIN` = chantakornproperty.com + benzttr12-sketch.github.io + localhost
- [x] flags: writes/publication/media/sessions/sweep/cache เปิดครบ (ดู `wrangler.prod.jsonc`)
- [x] migrations 0001–0007 + staff (ADMIN 2 บัญชี) + ทรัพย์ 3 รายการ + รูป 15 ใบ + audit

### ขั้น 3 — ทดสอบ prod แบบไร้ความเสี่ยง ✅ 2026-10-25
- [x] /health, /v1/properties (3 รายการ), รูปจาก R2 prod พร้อม cache policy,
      CORS จาก origin จริง, admin ปฏิเสธผู้ไม่มีสิทธิ์ (401), origin ปลอมไม่ได้ header
- [x] เว็บ GitHub Pages ชี้มาใช้ production Worker นี้แล้ว (repo variable
      `DEPLOY_CLOUDFLARE_API_ORIGIN`)

### ขั้น 4 — สลับ production (Vercel) ⏳ รอตั้งค่า 2 ตัวแปรบน dashboard
- [ ] บน Vercel → Project Settings → Environment Variables (Production) ตั้ง:
      1. `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND` = `cloudflare`
      2. `NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN` = `https://chantakorn-property-api.chantakorn-property.workers.dev`
      แล้ว Deployments → เวอร์ชันล่าสุด → **Redeploy**
- [ ] ตรวจหน้าเว็บ/หน้าแอดมิน/รูปทุกหน้าหลังสลับ
- [ ] **Rollback ทันทีได้**: เปลี่ยนตัวแปรแรกกลับเป็น `firebase` + Redeploy
      (ข้อมูล Firestore ยังครบทุกรายการ)

### ขั้น 5 — ระยะสังเกต (อย่างน้อย 1–2 สัปดาห์)
- [ ] เฝ้าดู errors/latency ของ Worker (Cloudflare dashboard)
- [ ] เก็บ backup D1 สม่ำเสมอ (`wrangler d1 export`)
- [ ] หลังมั่นใจ: ปิดการเขียนทรัพย์ลง Firestore (แจ้งทีมให้ใช้แอดมินบน D1 เท่านั้น)
      แล้วจึงจัดเก็บ/ลบข้อมูลทรัพย์เดิมใน Firestore ภายหลังตามนโยบาย backup

## สิ่งที่ยังค้าง (ไม่บังคับก่อน cutover)
- สมาชิก/โปรไฟล์บนเว็บ static กับ Vercel ใช้ Firestore ชุดเดียวกันอยู่แล้ว (ไม่ต้องทำอะไร)
- ระบบนับผู้ชมสถิติ/ประวัติการลงงานเฟส (work_jobs) ยังอยู่บน Firestore — ไม่เกี่ยวกับ cutover
- PR เก่า 6 รายการปิดหมดแล้ว
