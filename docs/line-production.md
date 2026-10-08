# เปิดใช้ LINE production

Runtime ปัจจุบันของ repository คือ Next.js บน Vercel ส่วน GitHub Pages เป็น static site และรับ webhook ไม่ได้ Cloudflare Worker จากรุ่นก่อนเป็น deployment แยกและไม่ได้ตามโค้ด main อัตโนมัติ

## ตั้งค่าที่ Vercel และ LINE

1. LINE Developers Console: เลือก Messaging API channel ของ OA `@930xzcyi`
2. Vercel project → Settings → Environment Variables → Production: ตั้ง `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_CHANNEL_SECRET` จาก LINE channel เดียวกัน แล้ว redeploy production
3. ตั้ง `NEXT_PUBLIC_SITE_URL=https://chantakoprnroperty.vercel.app` เพื่อให้การ์ดเปิดหน้าเว็บจริง
4. `LINE_TARGET_USER_ID` และ `LINE_ADMIN_USER_IDS` (คั่นด้วย comma) ใช้เฉพาะ private push ถึงเจ้าหน้าที่ที่อนุมัติ ไม่จำเป็นสำหรับการตอบลูกค้าผ่าน webhook ห้ามเพิ่มลูกค้าผู้ทักเข้ารายชื่อแอดมินโดยอัตโนมัติ

เก็บ token/secret ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่เก็บใน source, localStorage หรือ Firestore settings และไม่ส่งค่ากลับไปหน้าเว็บ หากค่าเคยถูกเผยแพร่ ผู้ดูแลต้องเปลี่ยนค่าที่ LINE และ Vercel และ redeploy; การนำค่าออกจาก source ไม่ยกเลิกค่าที่หลุดไปแล้ว

Firestore rules ต้องป้องกัน settings, profiles และกล่องข้อความลูกค้าด้วยสิทธิ์พนักงาน ห้ามเปิดสาธารณะหรือให้ผู้ใช้เปลี่ยน role ของตนเอง และต้อง deploy rules ไปยัง database ที่ระบุใน `firebase.json` แยกจากการ deploy Vercel

## ตรวจ deployment

เปิด `https://chantakoprnroperty.vercel.app/api/line/webhook`:

- `status: configured` และ credential flags ทั้งสองเป็น `true`
- `buildRevision` ตรงกับ commit ของ Vercel production deployment (`VERCEL_GIT_COMMIT_SHA`)
- `credentialValidation: presence_only` หมายถึงตรวจว่ามีค่าเท่านั้น ไม่ยืนยันว่า token ใช้ได้หรือส่งจริง

โค้ดจะปฏิเสธลายเซ็นไม่ถูกต้อง/ไม่มี secret และรายงานข้อผิดพลาดเมื่อ Reply API ไม่ยอมรับข้อความ ไม่ใช้ข้อมูลตัวอย่างแทน Firestore และเลือกเฉพาะรายการ `published: true`

## เปิด webhook

LINE Developers Console → Messaging API → Webhook settings:

1. ตั้ง Webhook URL เป็น `https://chantakoprnroperty.vercel.app/api/line/webhook`
2. กด Update แล้ว Verify ให้ได้ Success และเปิด Use webhook
3. ใน LINE OA Manager ปิด Auto-reply และ Greeting ที่ซ้ำกับคำตอบจากบอต

หนึ่ง channel ตั้ง webhook ได้หนึ่ง endpoint ห้ามใช้ Preview ที่ต้องล็อกอิน ถ้าเลือก Cloudflare ในอนาคต ต้อง deploy API แยกและตั้ง secrets ใน Worker แล้วเปลี่ยน URL โดยตรวจ flow จริงอีกครั้ง การตั้ง secrets ที่ Cloudflare ไม่ตั้งค่า Vercel ให้ด้วย

## ทดสอบข้อความจริง

1. ยืนยันว่า Firestore ของ production มีทรัพย์ `published: true` พร้อม slug
2. เพิ่มเพื่อน/ปลดบล็อก OA `@930xzcyi` จากบัญชี LINE ผู้ใช้
3. ส่ง `ดูทรัพย์` แล้วตรวจว่าได้รับการ์ดทรัพย์ที่เผยแพร่จริง ไม่มีร่างหรือข้อมูลตัวอย่าง
4. กดดูรายละเอียดจากการ์ด ตรวจว่าหน้าเว็บแสดงรายการตรงกัน
5. ตรวจ logs `[LINE Webhook] Processing result`: สำหรับข้อความหนึ่ง event ควรมี `successfulReplies: 1`, `failedReplies: 0`, `simulation: false` เก็บหลักฐานการได้รับการ์ดและเปิดรายละเอียดจริง

Verify ส่ง `events: []` จึงตรวจเพียงการเชื่อมต่อและลายเซ็น ไม่เรียก Reply API HTTP 200 อย่างเดียวก็ไม่ยืนยันการส่ง เพราะ response อาจเป็น `success: false` และ `failedReplies` มากกว่า 0

คำค้นสำหรับลูกค้า เช่น `ดูทรัพย์`, `ค้นหาทรัพย์`, `บ้านขาย หาดใหญ่`, `ที่ดิน สิงหนคร`, `คอนโดเช่า` และรหัส `CK-...` จะค้นเฉพาะทรัพย์ที่เผยแพร่ โดยต้องตรงกับประเภท สถานะ และทำเลที่ระบุ คำว่า `ฝากขายบ้าน` หรือ `ต้องการขายที่ดิน` จึงจะเปิดบริการฝากขาย หากไม่มีทรัพย์ตรงคำค้น ระบบจะแจ้งว่าไม่พบและให้ลิงก์รายการทรัพย์ หากอ่านฐานข้อมูลไม่ได้ ระบบจะแจ้งว่าค้นหาไม่ได้ชั่วคราว แทนการตอบเสมือนว่าค้นสำเร็จ

ระบบพยายามตอบ LINE ก่อนบันทึกข้อความลูกค้าและผู้ติดตามลง Firestore เพื่อให้การบันทึกที่ช้าหรือขัดข้องไม่หน่วงการตอบ ผลบันทึกที่ล้มเหลวแสดงใน `failedInquiryWrites` หรือ `failedFollowerWrites` แยกจากการส่งคำตอบ บันทึกข้อผิดพลาดของ Reply API ใช้รหัสสาเหตุ โดยไม่บันทึก access token, reply token หรือข้อความของลูกค้า

พนักงานใช้ปุ่ม **ตรวจการเชื่อมต่อ LINE OA** ใน `/admin/settings` เพื่อตรวจว่า LINE ยอมรับ Token, Token เป็นของ OA `@930xzcyi`, เปิด Use webhook และ URL ตรงกับเว็บไซต์ พร้อมตรวจรายการทรัพย์ที่เผยแพร่ ปุ่มนี้ไม่ส่งข้อความและไม่เปลี่ยนการตั้งค่า เรียกได้เฉพาะพนักงานที่เข้าสู่ระบบ ข้อมูลตอบกลับไม่มี secrets หรือข้อมูลลูกค้า การตรวจ Channel Secret เป็นการตรวจว่ามีค่าเท่านั้น ต้องกด Verify ใน LINE Console และส่งข้อความจากบัญชีลูกค้าเพื่อยืนยันอีกครั้ง

ปุ่มจำลองในหน้าตั้งค่าสำหรับพนักงานตรวจการประมวลผลเท่านั้น ไม่เรียก LINE และไม่สร้าง inquiry ผลระบุ `simulation: true`, `simulatedReplies` และ `successfulReplies: 0`

ปุ่มส่งทรัพย์และปุ่มทดสอบส่งแจ้งเตือนของพนักงานเป็นการส่งด้วยตนเอง จึงใช้ได้แม้ปิดแจ้งเตือนอัตโนมัติไว้ การปิดสวิตช์ยังคงหยุดการแจ้งเตือนอัตโนมัติจากประกาศใหม่/ฟอร์มลูกค้า ผู้ใช้สาธารณะใช้ flags ทดสอบหรือส่งเองเพื่อข้ามสวิตช์ไม่ได้

หน้าจอจะแสดงว่าส่งคำขอสำเร็จเฉพาะเมื่อ HTTP สำเร็จและ API รายงาน `success: true`, `isRealSent: true` เท่านั้น หากข้ามการส่งหรือ LINE ปฏิเสธ จะแสดงเหตุผลและให้ลองใหม่ ปุ่มเปิดแชท LINE เพียงเปิดข้อความที่เตรียมไว้ ผู้ใช้ต้องกด Send ใน LINE เอง และไม่เรียก API แจ้งเตือนพนักงาน

รูปการ์ดแจ้งเตือนใช้รูปปกที่เลือกไว้ของทรัพย์ก่อน แล้วจึงใช้รูปจริงจากแกลเลอรี รูปอัปโหลดจะให้ LINE ดาวน์โหลดผ่าน `/api/line/property-image?id=...&v=...` ของ API production ซึ่งเปิดเฉพาะรูปจากรายการที่เผยแพร่แล้วและเปลี่ยน URL เมื่อรูปปกเปลี่ยน ไม่ใช้ภาพ YouTube/รูปตัวอย่างแทน และไม่ใส่รูปเมื่อไม่มีรูปที่ใช้ได้ ลิงก์รายละเอียดใช้เว็บไซต์ที่ตั้งค่าไว้แยกจาก host ที่ให้บริการรูป

ฟอร์ม `/sell` เป็นอีกเส้นทาง: บันทึกฟอร์ม → เปิดแชต OA → ลูกค้ากด Send → ตรวจว่ามีข้อความและไม่สร้าง inbox ซ้ำจาก `[CP-WEB-FORM:...]`

## ตรวจปัญหา

| อาการ | สิ่งที่ตรวจ |
|---|---|
| `configuration_required` | Environment Variables ของ Vercel production และ redeploy หลังเปลี่ยนค่า |
| `buildRevision` ไม่ตรง | commit และ alias ของ production deployment |
| Verify ไม่ผ่าน / webhook 401 | Secret ของ channel, URL, การเข้าถึง HTTPS และลายเซ็นของ body เดิม |
| Reply API 401 | Access token หมดอายุ/ถูกยกเลิกหรือเป็นคนละ channel |
| Reply API 400 | รูปแบบ Flex และ reply token จาก event จริง |
| แจ้งเตือน `LINE_TOKEN_MISSING` | ตั้ง access token ที่ Vercel Production แล้ว Redeploy |
| แจ้งเตือน `LINE_RECIPIENT_MISSING` / `LINE_RECIPIENT_INVALID` | ตั้ง `LINE_TARGET_USER_ID` หรือ `LINE_ADMIN_USER_IDS` เป็น user ID ของเจ้าหน้าที่จาก provider เดียวกัน: `U` ตามด้วย hex 32 ตัว ไม่ใช่ชื่อผู้ใช้หรือ `@LINE ID` แล้ว Redeploy; ผู้รับต้องเป็นเพื่อนกับ OA และไม่บล็อก |
| ไม่มีการ์ดทรัพย์ | Query Firestore, rules และข้อมูล `published: true` |
| รายละเอียดเปิดผิดที่ | `NEXT_PUBLIC_SITE_URL` และ slug |

หาก deployment ใหม่ทำให้ flow เดิมเสีย ให้ rollback ใน Vercel แล้วตรวจ webhook ซ้ำ ไม่เปลี่ยนหรือแสดง secrets เพื่อแก้เฉพาะหน้า

อ้างอิง: [LINE settings](https://developers.line.biz/en/docs/messaging-api/building-bot/), [verify webhook](https://developers.line.biz/en/docs/messaging-api/verify-webhook-url/), [signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
