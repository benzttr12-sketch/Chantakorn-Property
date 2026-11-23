# Cloudflare D1/R2: สถานะแคตตาล็อกและแผนกู้คืน

## ขอบเขตของระบบ

| ข้อมูลหรือเส้นทาง | ฐานข้อมูลและบริการที่ใช้ |
| --- | --- |
| แคตตาล็อกทรัพย์ หน้าแอดมินทรัพย์ และรูปทรัพย์ | Cloudflare D1/R2 เมื่อเลือก backend `cloudflare` |
| Sitemap และข้อมูลทรัพย์ในข้อความ LINE | แคตตาล็อกเดียวกับหน้าเว็บ |
| บัญชีและการเข้าสู่ระบบ | Firebase Authentication |
| โปรไฟล์สมาชิก นายหน้าแนะนำ ลูกค้าสอบถามและรูปส่วนตัว งานติดตาม รีวิว การตั้งค่า และสถานะ LINE | Firestore และ API บน Vercel |
| สิทธิ์พนักงานบน Worker | D1 `profiles` พร้อมตรวจว่าบัญชี Firebase ยังใช้งานได้ |
| นายหน้าที่ผูกกับประกาศ | D1 `agents` ผ่าน `/v1/admin/agents` และตัวอ่านทรัพย์ แสดงข้อมูลติดต่อสาธารณะเฉพาะ `is_public=1` |

`next.config.mjs` ตั้ง `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=cloudflare` และ `NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN=https://chantakorn-property-api.chantakorn-property.workers.dev` เป็นค่าเริ่มต้น ตรวจค่าที่ deployment ใช้จริง เพราะ Vercel แทนค่าได้ และ GitHub Pages อ่าน `DEPLOY_PROPERTY_BACKEND` กับ `DEPLOY_CLOUDFLARE_API_ORIGIN` ตอน build ข้อมูลธุรกิจในตารางข้างต้นยังคงใช้ Firestore ตามขอบเขตนี้ รวมถึงข้อมูลลูกค้าและ LINE [คู่มือตั้งค่า LINE](line-production.md)

## หลักฐาน production

- 22 พ.ย. 2026 ใช้ migration `0008_catalog_agent_generation.sql` บน D1 `chantakorn-property-prod` แล้ว ตรวจพบ trigger สำหรับล้าง cache ของนายหน้าครบทั้งสามรายการ และ Worker `a0c7e9c2` รับ traffic 100% โดยคง D1/R2 bindings และค่าเดิมไว้ ไฟล์สื่ออยู่ใน bucket ส่วนตัว `chantakorn-property-media-prod` และ `chantakorn-inquiry-private-prod` [PR #115](https://github.com/benzttr12-sketch/Chantakorn-Property/pull/115)
- หลังปล่อย `e4fcf5b` ตรวจแคตตาล็อก รายละเอียด และรูปตัวอย่างจาก R2 ผ่านทั้ง `chantakornproperty.com` และ `www.chantakornproperty.com` เส้นทาง `/v1/admin/agents` ปฏิเสธคำขอที่ไม่มีสิทธิ์และตอบ CORS สำหรับทั้งสองโดเมน ส่วน build และ deploy ของ GitHub Pages ผ่านสำหรับ commit เดียวกัน [ผล deploy Pages](https://github.com/benzttr12-sketch/Chantakorn-Property/actions/runs/45035371387)
- หลังปล่อย `6f0fb6e` ตรวจ webhook ทั้งสองโดเมนแล้วพบ `textReplyPolicy=explicit_commands` การส่งและตอบจากบัญชี LINE จริงยังต้องยืนยันแยก การ build และ deploy ของ GitHub Pages ผ่านสำหรับ commit นี้ด้วย [PR #116](https://github.com/benzttr12-sketch/Chantakorn-Property/pull/116) · [ผล deploy Pages](https://github.com/benzttr12-sketch/Chantakorn-Property/actions/runs/45148774280)

บันทึกวันที่ 3 พ.ย. 2026 ระบุว่า DNS resolve ได้และเว็บตอบ HTTP 200 ทั้งสองโดเมน เจ้าของเว็บยืนยันว่าเปิดบนมือถือและโหลดรูปได้หลังแก้ DNS การเข้าใช้งานจากบัญชีพนักงานและการทดสอบสร้าง อัปโหลดรูป แก้ไข เผยแพร่ และยกเลิกเผยแพร่ต้องทดสอบเพิ่มใน staging ที่แยกจาก production [รายละเอียดการตรวจและข้อจำกัดของ Worker](cloudflare-d1-r2-release-readiness.md)

## ที่มาของประกาศและการสำรองข้อมูล

แผนเดิมใช้ [fresh start](cloudflare-d1-r2-fresh-start.md) สำหรับแคตตาล็อกทรัพย์ บันทึกวันที่ 25 ต.ค. กล่าวถึงการนำประกาศเก่าเข้ามา แต่ยังขาดหลักฐานเทียบที่มารายรายการ หากต้องยืนยัน ให้ตรวจประวัติและ audit events แบบอ่านอย่างเดียว เทียบตัวระบุและรูปของแต่ละทรัพย์ก่อนพิจารณาย้ายข้อมูล ใช้บันทึกเดิมเป็นประวัติและคงข้อมูลเดิมไว้ระหว่างตรวจ

วันที่ 3 พ.ย. 2026 ผู้ดูแลสร้าง archive เข้ารหัสสำหรับ Firestore, Firebase Auth metadata และวัตถุ R2 ตรวจ checksum และการยืนยันความถูกต้องของ archive แล้ว ทดสอบกู้ข้อมูลจริง Firestore หนึ่งรายการใน emulator ส่วนตัวบน loopback และอ่านค่ากลับตรงกัน ข้อมูล Auth ใน archive เป็น metadata เท่านั้น การสำรอง D1 การทดสอบกู้ R2 การกู้ระบบครบชุด และสำเนานอกเครื่องยังต้องมีหลักฐานแยก Archive ที่สร้างขณะระบบรับข้อมูลอาจไม่สะท้อนจุดเวลาเดียวกัน [คู่มือสำรองสำหรับผู้ดูแล](admin-backup-operations.md) · [คู่มือสำรอง Firestore](firestore-encrypted-backup-runbook.md)

งานที่ยังต้องตรวจเพื่อให้กู้คืนได้จริง

- สำรองและทดลองกู้ D1 ในระบบแยก แล้วเทียบ metadata กับไฟล์ที่กู้จาก R2
- ตรวจ UID, role และสถานะบัญชี ลูกค้าค้างติดต่อ และข้อมูลผู้ติดตามกับสถานะ opt-out ของ LINE จาก inventory ที่ครบ แยกผลว่าตรวจจบออกจากผลว่าข้อมูลตรงกัน และให้ผู้ดูแลตรวจข้อค้นพบก่อนแก้บัญชี
- กำหนดอายุเก็บรักษา สำเนาเข้ารหัสนอกเครื่อง และกุญแจกู้คืนแบบพกพาที่เก็บแยกจาก archive เก็บไฟล์ กุญแจ และข้อมูลส่วนบุคคลไว้นอก Git และ CI
- หากจะเปลี่ยนฐานข้อมูลที่รับการเขียน ให้หยุดงานเขียนที่เกี่ยวข้องหรือเก็บและกระทบยอด final delta หลัง snapshot เพื่อให้ครอบคลุมรายการที่สร้าง แก้ และลบระหว่างสำรอง

## ตรวจระบบก่อนและหลังปล่อยเวอร์ชันใหม่

1. บันทึก commit, deployment และค่าที่ใช้งานจริง ตรวจ Worker bindings, migrations, feature flags, Cron และ CORS ของทั้งสองโดเมนโดยเก็บ secrets ไว้ในระบบเดิม หาก frontend ต้องใช้ migration หรือ endpoint ใหม่ ให้ปล่อย D1 schema และ Worker ก่อน frontend
2. รัน `npm run verify:cloudflare -- --require-listings` จาก root เพื่อตรวจรายการสาธารณะ CORS รายละเอียด และรูปจาก R2 หนึ่งรายการ ผลตรวจนี้ยืนยันเฉพาะตัวอย่างที่อ่าน ตรวจสิทธิ์และการเขียนแยกใน staging
3. ทดสอบ Google login และ logout ทั้งสองโดเมน จากนั้นใช้บัญชีทดสอบสร้าง draft → อัปโหลดรูป → แก้ไข → publish → เปิดรายการสาธารณะ ตรวจบัญชีที่ถูกเพิกถอนสิทธิ์และ revision เก่าด้วย ทดสอบ LINE จากบัญชีลูกค้าด้วยข้อความทั่วไปและคำสั่ง `ดูทรัพย์`
4. ตรวจ role ใน Firestore และ D1 เมื่อเพิ่มหรือลดสิทธิ์พนักงาน หน้า `/admin/users` แก้ Firestore ส่วน `staff:import` เพิ่มเฉพาะโปรไฟล์ D1 ที่ยังไม่มี การเปลี่ยน role เดิมใน D1 ต้องดำเนินการผ่านผู้ดูแลที่ได้รับสิทธิ์
5. ตรวจ errors, latency, query cost และ media sweep alerts หลังปล่อย ยืนยันผลรันจริงและช่องทางแจ้งเตือนของระบบเฝ้าระวัง [PR #101](https://github.com/benzttr12-sketch/Chantakorn-Property/pull/101)

## ย้อนกลับหลังมีการเขียนข้อมูลใหม่

ถ้าปัญหาอยู่ที่ deployment ให้ย้อนกลับไปยังเวอร์ชันและค่าที่บันทึกไว้ พร้อมตรวจว่าเวอร์ชันนั้นยังใช้ D1/R2 และ schema ปัจจุบันได้ การตั้ง `NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND=firebase` แล้ว redeploy เปลี่ยนปลายทางการอ่านและเขียนเท่านั้น

หากจำเป็นต้องย้ายการเขียนกลับ Firestore ให้หยุดการเขียนทรัพย์จากทุก deployment ที่เกี่ยวข้อง เก็บ backup ทั้งสองฝั่ง และกระทบยอดรายการที่สร้าง แก้ และลบใน D1 รวมถึงรูปจาก R2 และลิงก์ที่แชร์แล้ว เมื่อยืนยันข้อมูลครบ ให้เปิดการเขียนที่ฐานข้อมูลเดียวและตรวจหน้าเว็บ รูป และสิทธิ์พนักงานอีกครั้ง คง Firestore และ Firebase Auth ไว้สำหรับข้อมูลและบัญชีที่ยังใช้งานอยู่
