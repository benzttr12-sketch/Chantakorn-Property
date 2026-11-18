# สถานะและขั้นตอนตรวจการย้ายแคตตาล็อกไป Cloudflare D1/R2

## ขอบเขตที่โค้ดรองรับ

`next.config.mjs` และตัวอ่านแคตตาล็อกกำหนดค่าเริ่มต้นเป็น:

```text
NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=cloudflare
NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN=https://chantakorn-property-api.chantakorn-property.workers.dev
```

ค่า environment ของ Vercel สามารถแทนค่าเหล่านี้ได้ ส่วน GitHub Pages ใช้ `DEPLOY_PROPERTY_BACKEND` และ `DEPLOY_CLOUDFLARE_API_ORIGIN` ตอน build ค่าเริ่มต้นใน repository จึงไม่ใช่หลักฐานว่า deployment ปัจจุบันใช้ฐานข้อมูลใด

| ข้อมูล/เส้นทาง | ระบบที่โค้ดใช้ |
| --- | --- |
| แคตตาล็อกทรัพย์, หน้าแอดมินทรัพย์, รูปทรัพย์ | Cloudflare D1/R2 เมื่อเลือก `cloudflare` |
| sitemap และข้อมูลทรัพย์ใน LINE cards/replies | แคตตาล็อกเดียวกับหน้าเว็บ |
| บัญชีและการเข้าสู่ระบบ | Firebase Authentication |
| สมาชิก, นายหน้าแนะนำบนหน้าเว็บ, ลูกค้าสอบถามและรูปส่วนตัว, งานติดตาม, รีวิว, settings และสถานะ LINE | Firestore และ API เดิมบน Vercel |
| สิทธิ์พนักงานสำหรับ Worker | D1 `profiles` พร้อมตรวจบัญชี Firebase ที่ยังใช้งานได้ |
| นายหน้าที่เลือกผูกกับทรัพย์และข้อมูลติดต่อในประกาศ | D1 `agents` ผ่าน `/v1/admin/agents` และตัวอ่านทรัพย์; ข้อมูลติดต่อสาธารณะส่งเฉพาะ `is_public=1` แยกจากนายหน้าแนะนำบนหน้าเว็บ |

การมีตารางลูกค้า/LINE/work jobs ใน D1 ยังไม่หมายความว่าเส้นทางใช้งานเหล่านั้นย้ายแล้ว ขอบเขตการย้ายนี้มีเฉพาะแคตตาล็อกทรัพย์ ส่วนข้อมูลธุรกิจอื่นคงใช้ Firebase

## หลักฐานย้อนหลัง

บันทึกเดิมวันที่ 2026-10-25 ระบุว่าได้สร้าง Worker production, D1 `chantakorn-property-prod`, R2 `chantakorn-property-media-prod` / `chantakorn-inquiry-private-prod` และนำเข้าทรัพย์ 3 รายการพร้อมรูป 15 ใบแล้ว ต่อมา commit `6c4e443` เปลี่ยนค่าเริ่มต้นของเว็บเป็น Cloudflare ส่วนการแก้ CORS ล่าสุดเก็บทั้งโดเมนหลักและ `www` ไว้

จำนวนรายการ ชื่อ resource, flags, การทดสอบ UI และ backup จากบันทึกเก่าไม่ใช่ผลตรวจปัจจุบัน ห้ามนำรายการทรัพย์เดิมเข้าซ้ำหรือสร้าง resource ทดแทนจากบันทึกนี้โดยไม่ตรวจข้อมูลที่มีอยู่ก่อน [แผน fresh-start](cloudflare-d1-r2-fresh-start.md) เป็นเอกสารย้อนหลังและไม่ใช่คำสั่งล้างฐานข้อมูล

## ตรวจระบบก่อนเปลี่ยน deployment

ลำดับเผยแพร่ส่วนที่เพิ่มใหม่คือ **ใช้ D1 migrations จนถึง `0008_catalog_agent_generation.sql` → deploy Worker → deploy frontend → ตรวจ smoke และ flow ที่เกี่ยวข้อง** migration 0008 เพิ่มการล้าง cache เมื่อข้อมูลนายหน้าเปลี่ยน ส่วน Worker เปลี่ยน cache namespace เพื่อไม่ใช้ payload เก่าที่ไม่มีข้อมูลติดต่อ ข้อความนี้เป็นขั้นตอนสำหรับเผยแพร่ ไม่ใช่หลักฐานว่า production ทำแล้ว

1. ตรวจ production deployment และ environment overrides ของ Vercel/Pages แล้วเทียบ API origin ที่เบราว์เซอร์เรียกจริงกับ Worker ที่ตั้งใจใช้ อย่าเปลี่ยน env เพียงเพราะเอกสารเก่าระบุว่ายังไม่ cutover
2. รัน `npm run verify:cloudflare -- --require-listings` จาก root เพื่อตรวจ public catalog/CORS และสุ่มตรวจ detail กับรูปจาก R2 หนึ่งรายการแบบอ่านอย่างเดียว `--require-listings` ไม่ยอมให้แคตตาล็อกว่างผ่านโดยข้าม detail/media ไม่ใช่การตรวจครบทุกรายการ `/health` อย่างเดียวไม่ตรวจการเชื่อม D1/R2 ผล public smoke ไม่ยืนยันสิทธิ์พนักงานหรือการเขียนข้อมูล
3. ตรวจ Worker bindings, migrations 0001–0008, feature flags และ Cron ในบัญชีที่ถูกต้อง เก็บทั้ง `https://chantakornproperty.com` และ `https://www.chantakornproperty.com` ใน `ALLOWED_ORIGIN` พร้อม origin อื่นที่อนุมัติไว้
   หาก frontend ใช้ `/v1/admin/agents` ต้อง deploy และตรวจ endpoint ของ Worker ก่อน deploy frontend ที่เรียกใช้ การมี endpoint ใน repository ยังไม่ยืนยันว่า production มีแล้ว
4. ทดสอบ login → สร้าง draft → อัปโหลดรูป → แก้ไข → publish → เปิดหน้าสาธารณะใน staging ที่แยกจาก production ตรวจ disabled/revoked account และ stale revision ด้วย ใช้ข้อมูลทดสอบที่ระบุชัดเจน
5. ตรวจ staff UID และ role ทั้ง D1/Firestore: `/admin/users` แก้ Firestore เท่านั้น ส่วน `staff:import` เพิ่มเฉพาะ D1 profile ที่ยังไม่มีและไม่แก้ role เดิม การเพิ่ม/ลดสิทธิ์ต้องมีขั้นตอนผู้ดูแลสำหรับทั้งสองระบบ
6. ยืนยัน backup D1/R2 และ Firestore/Auth ที่เข้ารหัส พร้อมทดสอบ restore และบันทึกเวลา/ขอบเขต/ข้อจำกัด ดู [backup operations](admin-backup-operations.md) และ [Firestore runbook](firestore-encrypted-backup-runbook.md) การมีสคริปต์ backup ไม่ยืนยันว่า backup จริงเสร็จแล้ว
7. เฝ้าดู errors, latency, query cost และ media sweep alerts บน Worker หลังเปลี่ยน deployment พร้อมบันทึก commit และผลตรวจ โดยไม่แนบ secrets หรือข้อมูลลูกค้า

## ย้อนกลับเมื่อมีข้อมูลใหม่หลัง cutover

การเปลี่ยน `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=firebase` แล้ว redeploy เปลี่ยนเพียงปลายทางอ่าน/เขียน และไม่คัดลอกทรัพย์หรือรูปที่เพิ่มใน D1/R2 กลับ Firestore

ก่อนย้อนกลับต้องหยุดการเขียนทรัพย์จากทุก deployment ที่เกี่ยวข้อง เก็บ backup ของทั้งสองฝั่ง ตรวจและกระทบยอดรายการที่สร้าง/แก้/ลบหลัง cutover รวมถึงรูปและลิงก์ แล้วเลือกฐานข้อมูลที่เป็นผู้รับเขียนเพียงแห่งเดียว เมื่อยืนยันข้อมูลครบจึงเปลี่ยน env/redeploy และทดสอบหน้าเว็บกับสิทธิ์พนักงานอีกครั้ง ห้ามเปิดเขียนสองฝั่งระหว่างกระทบยอด ห้ามลบ Firebase Auth หรือ Firestore เพราะข้อมูลธุรกิจอื่นยังใช้งานอยู่
