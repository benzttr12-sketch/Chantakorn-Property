# เปิดใช้ LINE production

หน้าเว็บ GitHub Pages และ Cloudflare Worker เป็นคนละ deployment การ merge PR และ workflow Pages สำเร็จไม่ยืนยันว่า API ได้รับโค้ดรุ่นเดียวกัน

## การตั้งค่าใน LINE และ Cloudflare

1. เลือก Messaging API channel ที่ผูกกับ OA `@930xzcyi` ใน LINE Developers Console
2. ใช้ channel access token จากแท็บ Messaging API และ channel secret จาก Basic settings ของ channel เดียวกัน หากมีค่าที่ใช้งานได้อยู่แล้ว ไม่ต้องออกใหม่
3. ใน Cloudflare → Workers & Pages → `chantakorn-property-api` → Settings → Variables and Secrets ตั้ง `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_CHANNEL_SECRET` เป็น Secret แล้ว Deploy ห้ามใส่ค่าใน Git, `NEXT_PUBLIC_*` หรือหน้าเว็บ
4. ตั้ง `NEXT_PUBLIC_SITE_URL` เป็น `https://benzttr12-sketch.github.io/Chantakorn-Property` เพื่อให้ลิงก์การ์ดไปยังเว็บไซต์ และ `ALLOWED_ORIGINS` เป็น `https://benzttr12-sketch.github.io` สำหรับการเรียก API จากหน้าเว็บ
5. `LINE_TARGET_USER_ID` จำเป็นเฉพาะ private push ถึงเจ้าหน้าที่ ไม่จำเป็นสำหรับ Reply API ที่ตอบบัญชีลูกค้าผู้ส่งข้อความ

## เผยแพร่โค้ดและตรวจรุ่น

จาก checkout ที่สะอาดและ commit แล้ว:

```sh
npm test
npm run lint
npm run typecheck
npm run deploy:worker -- --dry-run
npm run deploy:worker
```

`deploy:worker` รักษาตัวแปรและ secrets เดิม และกำหนด `APP_BUILD_SHA` จาก Git HEAD ห้าม deploy ขณะมีไฟล์แก้ไขที่ยังไม่ commit เพราะ SHA จะระบุโค้ดที่เผยแพร่ไม่ได้

เปิด `https://chantakorn-property-api.chantakorn-property.workers.dev/api/line/webhook` แล้วตรวจ:

- `buildRevision` ตรงกับ commit ที่ deploy
- `status: configured` และ credential flags ทั้งสองเป็น `true`
- `credentialValidation: presence_only` หมายถึงตรวจว่ามีค่าเท่านั้น ยังไม่ได้ตรวจ token กับ LINE

สำหรับหน้าเว็บ ให้ตั้ง GitHub repository variable `NEXT_PUBLIC_API_BASE_URL` เป็น `https://chantakorn-property-api.chantakorn-property.workers.dev` แล้วเผยแพร่ Pages ใหม่เมื่อเปลี่ยนค่านี้

## เปิด webhook

ใน LINE Developers Console → Messaging API → Webhook settings:

1. ตั้ง Webhook URL เป็น `https://chantakorn-property-api.chantakorn-property.workers.dev/api/line/webhook`
2. กด Update แล้ว Verify ให้ได้ Success และเปิด Use webhook
3. ตรวจ Auto-reply และ Greeting ใน LINE OA Manager หากตั้งให้บอตจัดการคำตอบ ให้ปิดข้อความสำเร็จรูปที่ซ้ำกัน

หนึ่ง channel ตั้ง webhook ได้หนึ่ง endpoint หากเลือกใช้ Vercel แทน Worker ต้องตั้ง secrets และตรวจรุ่นใน Vercel และใช้ production URL ที่ LINE เข้าถึงได้โดยไม่ต้องล็อกอิน ห้ามใช้ Preview ที่มี deployment protection

## ทดสอบข้อความจริง

1. ยืนยันว่า Firestore ของ Worker มีทรัพย์ `published: true` พร้อม slug และหน้าเว็บอ่านข้อมูลจากฐานเดียวกัน
2. เพิ่มเพื่อน/ปลดบล็อก OA `@930xzcyi` จากบัญชี LINE ผู้ใช้
3. ส่งข้อความ `ดูทรัพย์` แล้วตรวจว่าได้รับการ์ดของทรัพย์ที่เผยแพร่จริง ไม่มีร่างหรือข้อมูลตัวอย่าง
4. กดดูรายละเอียดบนเว็บจากการ์ด ตรวจว่าเปิด `/properties/detail/?slug=...` และแสดงรายการตรงกัน
5. ตรวจ Worker logs รายการ `[LINE Webhook] Processing result`: สำหรับข้อความหนึ่ง event ควรมี `successfulReplies: 1`, `failedReplies: 0`, `simulation: false` และไม่มี error จาก Reply API เก็บหลักฐานการได้รับการ์ดและเปิดรายละเอียดจริง

Verify ส่ง `events: []` จึงตรวจได้เพียงการเชื่อมต่อและลายเซ็น ไม่ได้ทดสอบ Reply API HTTP 200 อย่างเดียวก็ยังไม่ยืนยันการส่ง เพราะ webhook อาจส่ง `success: false` และ `failedReplies` มากกว่า 0 ต้องดู logs และการได้รับข้อความจริงประกอบ

ปุ่มจำลองในหน้าตั้งค่าสำหรับพนักงานตรวจการประมวลผลเท่านั้น ไม่เรียก LINE Reply API และไม่สร้าง inquiry ผลจะระบุ `simulation: true`, `simulatedReplies` และ `successfulReplies: 0`

สำหรับ `/sell` ให้ทดสอบอีกเส้นทาง: บันทึกฟอร์ม → เปิดแชต OA → ลูกค้ากด Send → ตรวจว่าแชตได้รับข้อความและ inbox ไม่มีรายการซ้ำจาก `[CP-WEB-FORM:...]`

## ตรวจปัญหา

| อาการ | สิ่งที่ตรวจ |
|---|---|
| `configuration_required` | Secret ชื่อถูกต้องและ deploy ใน runtime ที่ webhook ชี้ไป |
| `buildRevision` ไม่ตรงหรือเป็น `unknown` | Deploy Worker ด้วยคำสั่งของ repository จาก commit ที่ต้องการ |
| Verify ไม่ผ่าน / webhook 401 | Secret ของ channel, URL, การเข้าถึง HTTPS และลายเซ็นของ body เดิม |
| Reply API 401 | Access token หมดอายุ/ถูกยกเลิกหรือเป็นคนละ channel |
| Reply API 400 | รูปแบบ Flex และ reply token จาก event จริง |
| มีข้อความต้อนรับแต่ไม่มีการ์ดทรัพย์ | Query Firestore, rules และข้อมูล `published: true`; โค้ดไม่ใช้ข้อมูลตัวอย่างแทน |
| การ์ดเปิดรายละเอียดผิดที่ | `NEXT_PUBLIC_SITE_URL` ใน Worker และ slug ของรายการ |

หาก deployment ทำให้ flow เดิมเสีย ใช้ Cloudflare deployment ก่อนหน้าเพื่อ rollback และตรวจ webhook ซ้ำ ห้ามเปลี่ยนหรือแสดงค่า secrets เพื่อแก้ปัญหาเฉพาะหน้า

อ้างอิง: [LINE bot settings](https://developers.line.biz/en/docs/messaging-api/building-bot/), [verify webhook](https://developers.line.biz/en/docs/messaging-api/verify-webhook-url/), [signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
