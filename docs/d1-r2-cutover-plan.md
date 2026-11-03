# Cloudflare D1/R2: สถานะและเงื่อนไขก่อนเปลี่ยน production

ปรับปรุง 3 พฤศจิกายน 2026 แทนบันทึกวันที่ 25 ตุลาคมที่ยังระบุว่า Vercel รอตั้งค่า
และกล่าวว่านำประกาศเก่า 3 รายการเข้า D1 โดยไม่มีหลักฐานยืนยันประกอบในเอกสาร
ห้ามใช้บันทึกเดิมเป็นคำสั่ง import หรือเป็นหลักฐานว่าการย้ายและกู้คืนผ่านครบแล้ว

## ขอบเขตที่ต้องรักษา

- ใช้ fresh start สำหรับแคตตาล็อกทรัพย์ ไม่ย้ายประกาศเก่า 3 รายการอัตโนมัติ
  หากพบรายการที่อาจเคยนำเข้า ให้ตรวจที่มาและ audit events แบบอ่านอย่างเดียวก่อน
  การแก้เอกสารนี้ไม่ได้ยืนยันหรือย้อนกลับข้อมูลจริง
- คง Firestore และ Firebase Auth ไม่ลบฐานข้อมูล บัญชี หรือโครงการ
  ข้อมูลลูกค้าและ LINE ต้องยังเข้าถึงได้ตามสิทธิ์เดิม
- ไม่สร้างโปรไฟล์ ยกระดับสิทธิ์ หรือเปลี่ยนสถานะยืนยันอีเมลเพื่อให้การตรวจผ่าน
  ต้องตรวจตัวตนและเหตุผลกับแอดมินก่อน ไม่แก้บัญชีจาก snapshot เก่าอัตโนมัติ
- ไม่เปลี่ยน billing หรือสร้างบริการเสียเงินจากแผนนี้
- แยก PR เล็ก ตรวจ CI และพฤติกรรมจริงก่อน merge/deploy การสำรองขณะระบบรับข้อมูล
  ไม่ใช่ atomic snapshot และไม่ยืนยันว่า cutover พร้อม

## หลักฐานปัจจุบันและข้อจำกัด

| ส่วน | สิ่งที่ตรวจได้ | สิ่งที่ยังต้องแยกตรวจ |
|---|---|---|
| โค้ด main | `next.config.mjs` ตั้งค่าเริ่มต้นแคตตาล็อกเป็น `cloudflare` พร้อม production Worker origin แล้ว | Environment ของ deployment อาจ override ได้ |
| Public Worker | `/v1/properties?limit=1` ตอบ 200 และ CORS ถูกต้องทั้ง apex/www | ไม่ใช่หลักฐานว่าทุกประกาศมีที่มาถูกต้อง |
| R2 สาธารณะ | โหลด cover ผ่าน `/v1/media/properties/` ได้ | ต้องทดสอบกู้ object bytes และความสัมพันธ์กับ D1 แยกจากการเปิดรูป |
| DNS/HTTPS | Google/Cloudflare DNS resolve ทั้งสอง host เว็บตอบ 200 | ยังต้องเฝ้าระวัง registrar, DNSSEC, ใบรับรอง และวันหมดอายุ |
| มือถือ | เจ้าของเว็บยืนยันว่าเปิดได้และรูปทรัพย์โหลดครบหลังแก้ DNS | ไม่ใช่การวัดความเร็วหรือทดสอบทุกรุ่น |
| Google Login | มี first-party handler ทั้งสอง host และชุดทดสอบ session/account switching/สิทธิ์ | การเลือกบัญชีจริงและ logout เป็น release gate แยกจาก HTTP 200 |
| Sitemap/robots | เส้นทางตอบ 200 และชุดทดสอบ sitemap/ลิงก์เดิมผ่าน | ไม่ได้ยืนยันว่า search engine index หรือ Facebook ดึงข้อมูลใหม่แล้ว |
| ไฟล์สำรองเดิม | ตรวจความสมบูรณ์ Firestore/Auth metadata/R2 ที่เข้ารหัสได้ | ไม่ครอบคลุม D1 ไม่ใช่หลักฐานกู้จริงหรือสำเนานอกเครื่อง |

แคตตาล็อกทรัพย์ใช้ D1/R2 ส่วน Firebase Auth, โปรไฟล์, ลูกค้าสอบถามและ LINE
ยังใช้ Firebase ตามเส้นทางที่เกี่ยวข้อง ดู [คู่มือสำรองสำหรับแอดมิน](admin-backup-operations.md)
และ [คู่มือสำรอง Firestore](firestore-encrypted-backup-runbook.md)

Production Worker: `https://chantakorn-property-api.chantakorn-property.workers.dev`
ทรัพยากรที่ตั้งชื่อไว้คือ D1 `chantakorn-property-prod`, R2 `chantakorn-property-media-prod`
และ `chantakorn-inquiry-private-prod` ต้องตรวจ binding ของ deployment เป้าหมายก่อนใช้จริง
ไม่ใช้ config ของ dev แทน production

## เงื่อนไขที่ยังต้องปิดก่อนรับรองการย้ายและการกู้คืน

- [ ] ตรวจ effective backend/environment/binding ของ deployment ที่จะปล่อย โดยไม่พิมพ์ secrets
- [ ] ตรวจที่มาของประกาศเดิม 3 รายการกับข้อมูล D1 แบบอ่านอย่างเดียว ไม่ import ซ้ำหรือลบ
      และไม่สมมติว่าข้อมูลตรงกันเพราะจำนวนเท่ากัน
- [ ] สำรอง Firestore/Auth/R2 ล่าสุด ตรวจ checksum/authentication ทุกชุด บันทึกผู้ดูแลและเวลาไว้นอก repo
- [ ] เทียบ UID/role/สถานะบัญชี ลูกค้าค้างติดต่อ และ LINE follower/opt-out จาก inventory ที่ครบ
      แยก completed scan ออกจาก clean inventory และทบทวนข้อค้นพบกับข้อมูลปัจจุบัน
- [ ] มีหลักฐานสำรอง D1 ที่ตรวจและทดลองกู้ได้ แยกจาก vault ที่ครอบคลุมเฉพาะ Firestore/Auth/R2
- [ ] ทดลองกู้ restricted sample ของข้อมูลจริงในสภาพแวดล้อมส่วนตัวที่แยกจาก production
      การทดสอบ emulator ด้วยข้อมูลจำลองใช้แทนหลักฐานนี้ไม่ได้
- [ ] กำหนด retention, สำเนาเข้ารหัสนอกเครื่อง และกุญแจกู้คืนแบบพกพาที่แอดมินดูแลแยกจาก archive
      ปัจจุบันยังไม่มีที่เก็บนอกเครื่องที่กำหนด
- [ ] ทดสอบ API/Admin/รูป R2/Firebase Auth ทั้งสอง host และ LINE reply จริง
      พร้อมการปฏิเสธ token ปลอม บัญชีทั่วไป และบัญชีที่ถูกเพิกถอนสิทธิ์
- [ ] ก่อนเปลี่ยนเส้นทางข้อมูล กำหนดช่วงหยุดแก้ไขหรือ final delta ที่ตรวจแล้ว
      เพราะ live scan ไม่รับประกันว่าจับ concurrent writes ได้ครบ
- [ ] เปิด monitoring และยืนยันช่องทางรับแจ้งเตือนหลัง merge workflow
      การมี workflow ใน PR ไม่ได้แปลว่า schedule เริ่มทำงานแล้ว

เก็บรายละเอียดตัวตน ข้อมูลลูกค้า กุญแจ และไฟล์สำรองไว้นอก repo เท่านั้น
อย่าแนบ archive หรือ raw provider logs ใน GitHub Actions/PR

## การปล่อยและย้อนกลับ

1. บันทึก commit, deployment, backend/binding และผล validation ก่อนแก้
   ตั้งจุดย้อนกลับเป็นเวอร์ชันที่ตรวจแล้ว
2. ปล่อยทีละ PR หลัง validation ของขอบเขตนั้นผ่าน ไม่สลับฐานข้อมูลหรือ deploy เพียงเพราะ CI เขียว
3. ตรวจ listing/detail/cover/login/logout/Admin/LINE ตามส่วนที่กระทบ รวม cache invalidation
   และ pagination ไม่ทำ load test หนักกับ production
4. หากมีปัญหา ย้อนกลับ deployment/config ที่บันทึกและตรวจแล้ว
   ห้ามสลับไป Firestore อย่างเดียวโดยไม่ตรวจความสดของข้อมูลและ URL รูปก่อน
5. หลังเสถียร รักษา backup, monitoring และบันทึกการกู้คืนต่อเนื่อง
   ไม่มีขั้นตอนลบ Firestore หรือ Firebase Auth ในแผนนี้
