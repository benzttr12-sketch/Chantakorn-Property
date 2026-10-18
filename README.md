# CHANTAKORN PROPERTY

เว็บไซต์อสังหาริมทรัพย์ หาดใหญ่–สงขลา พัฒนาด้วย Next.js, TypeScript และ Tailwind CSS รองรับการรันบน Node.js และเผยแพร่ผ่าน GitHub Pages

## เริ่มใช้งานในเครื่อง

ใช้ Node.js 22.19.0 ขึ้นไป (แนะนำ Node.js 22 LTS) และ npm

```sh
npm ci
```

คัดลอก `.env.example` เป็น `.env.local` แล้วรัน:

```sh
npm run dev
```

เปิด http://localhost:3000

รูปแบบเว็บใช้ Tailwind CSS 4 รองรับ Safari 16.4+, Chrome 111+ และ Firefox 128+

ค่าเริ่มต้นใช้ Firebase สำหรับข้อมูลและบัญชีจริง หากต้องการดูหน้าเว็บในเครื่องโดยไม่เชื่อมฐานข้อมูล ให้กำหนด `NEXT_PUBLIC_DATA_BACKEND=local` อย่างชัดเจน โหมดนี้ใช้ข้อมูลสำหรับพัฒนา ฟอร์มไม่ส่งข้อมูลถึงทีมงาน และไม่มีระบบบัญชีหรือสิทธิ์พนักงานทดลอง

คำถามที่พบบ่อยใช้ข้อมูลที่เตรียมไว้ในโปรเจกต์ เครื่องมือร่างประกาศและโพสต์การตลาดใช้แม่แบบข้อความ ส่วนเตรียมสื่อรองรับการคัดลอกและดาวน์โหลดบรีฟให้ทีมผลิตสื่อ ฟังก์ชันเหล่านี้ไม่เรียกบริการ AI ภายนอกและไม่ต้องตั้งค่า API key สำหรับ AI

## ตรวจสอบและ build

```sh
npm run audit:security
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

หากต้องการไฟล์เว็บไซต์แบบ static:

```sh
npm run build:pages
npm run preview:pages
```

เปิด http://localhost:4173 ไฟล์สำหรับเผยแพร่อยู่ใน `.next-pages/` ไม่ต้อง commit โฟลเดอร์นี้

`build:pages` ใช้โหมดแสดงข้อมูลสำหรับพัฒนาโดยค่าเริ่มต้น แม้ในเครื่องมี `.env.local` สำหรับฐานข้อมูลจริง โหมดนี้ไม่มีบัญชีทดลอง เว็บไซต์ธุรกิจที่รับข้อมูลลูกค้าและใช้ LINE อยู่บน Vercel

## LINE production บน Vercel

ตั้ง `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_CHANNEL_SECRET` จาก Messaging API channel เดียวกันของ OA `@930xzcyi` ใน Vercel Production Environment Variables แล้ว redeploy ตั้ง Webhook URL เป็น `https://chantakoprnroperty.vercel.app/api/line/webhook` ใน LINE Developers Console กด Verify และเปิด Use webhook

`GET /api/line/webhook` แสดงสถานะและ commit (`buildRevision`) โดยไม่แสดง secrets คำว่า `configured` ตรวจเพียงว่ามีค่า ต้องส่ง `ดูทรัพย์` จากบัญชี LINE ผู้ใช้และเปิดรายละเอียดจากการ์ดเพื่อยืนยันการส่งจริง `LINE_TARGET_USER_ID` และ `LINE_ADMIN_USER_IDS` ใช้เฉพาะ private staff notifications ไม่ต้องใช้สำหรับการตอบลูกค้า ห้ามตั้ง GitHub Pages เป็น webhook หรือเก็บ secrets ในหน้าเว็บ/Firestore ดู [ขั้นตอนเปิดใช้และทดสอบ](docs/line-production.md)

## เผยแพร่บน GitHub Pages

1. Push โค้ดไปที่ `main` ของ repository
2. ใน GitHub ไปที่ **Settings → Pages → Build and deployment → Source → GitHub Actions**
3. ไปที่ **Actions → Build and deploy website → Run workflow** หรือ push commit ใหม่
4. รอ job `build` และ `deploy` สำเร็จ แล้วเปิด URL ที่แสดงใน environment `github-pages`

Workflow `.github/workflows/pages.yml` จะติดตั้งด้วย `npm ci`, ตรวจ lint/types, สร้าง static export และเผยแพร่เว็บ เส้นทาง CSS/JavaScript และลิงก์รองรับชื่อ repository ใน URL แล้ว

URL ตามชื่อ repository ปัจจุบันคือ `https://benzttr12-sketch.github.io/Chantakorn-Property/` โดยจะใช้ได้หลัง deploy สำเร็จและเปิด Pages แล้วเท่านั้น

### ทดสอบ URL ที่มีชื่อ repository ในเครื่อง (PowerShell)

```powershell
$env:NEXT_PUBLIC_BASE_PATH='/Chantakorn-Property'
$env:NEXT_PUBLIC_SITE_URL='https://benzttr12-sketch.github.io/Chantakorn-Property'
npm run build:pages
npm run preview:pages
```

เปิด http://localhost:4173/Chantakorn-Property/

ทรัพย์ตัวอย่างมีหน้าที่สร้างไว้ล่วงหน้า ส่วนทรัพย์ที่เพิ่มภายหลังใช้ `/properties/detail/?slug=...` เพื่อเปิดได้บน static hosting โดยไม่ต้อง build ใหม่ ข้อมูลจริงโหลดจาก backend ในเบราว์เซอร์

## Firebase สำหรับใช้งานจริง

ตั้ง `NEXT_PUBLIC_DATA_BACKEND=firebase` และค่า Firebase ตาม `.env.example` ใช้ Firebase Authentication สำหรับบัญชี และ Firestore สำหรับข้อมูลธุรกิจ รายการทรัพย์สาธารณะอ่านผ่าน `/api/properties` ซึ่งส่งเฉพาะข้อมูลที่เผยแพร่ รูปภาพและข้อมูลลูกค้าถูกควบคุมสิทธิ์บนเซิร์ฟเวอร์ ดู [การตั้งค่าเซิร์ฟเวอร์และระบบรูปภาพ](docs/security-media-operations.md)

บัญชี Firebase ใหม่เริ่มด้วย role `USER` เสมอ ไม่มีการยกสิทธิ์จากชื่อโดเมนหรืออีเมลใน browser การตั้ง Admin คนแรกต้องทำจาก Firebase Console หรือ Admin SDK ที่เชื่อถือได้ โดยแก้ `profiles/{uid}.role` เป็น `ADMIN` หลังจากผู้ใช้นั้นสมัครและมี profile แล้ว หลังจากนั้น Admin สามารถเปลี่ยน role ของ profile ที่มีอยู่ผ่านหน้า `/admin/users`

หน้า `/admin/users` ไม่สร้างหรือลบบัญชี Firebase Authentication และไม่เปลี่ยนอีเมลสำหรับเข้าสู่ระบบ เพราะการแก้ profile document อย่างเดียวไม่ใช่การจัดการ Auth account ให้สร้าง ลบ หรือเปลี่ยนอีเมลบัญชีผ่าน Firebase Authentication Console/Admin SDK แล้วใช้หน้านี้จัดการชื่อ เบอร์โทร และ role ของ profile

ค่าที่กำหนดใน `NEXT_PUBLIC_DATA_BACKEND` รองรับ `firebase` และ `local` เท่านั้น ค่าไม่ถูกต้องหรือฐานข้อมูลที่เชื่อมไม่ได้จะแสดงข้อผิดพลาด ไม่มีการสลับไปใช้ข้อมูลตัวอย่างโดยเงียบ ๆ

## ขอบเขตข้อมูล

- ทรัพย์ นายหน้า รีวิว และลูกค้าบน Firebase ใช้ข้อมูลในระบบจริง การอ่านข้อมูลไม่สร้างข้อมูลตัวอย่างลงฐานข้อมูล
- โหมด local ใช้ตรวจหน้าเว็บสำหรับพัฒนา ไม่มีบัญชีสมาชิกหรือสิทธิ์พนักงาน
- Favorites และรายการเปรียบเทียบเก็บ ID ของทรัพย์ที่ผู้ใช้เลือกในเบราว์เซอร์
- หน้าข้อมูลระบบแสดงโหมดที่เลือก การเปลี่ยนข้อมูลติดต่อหรือฐานข้อมูลต้องแก้โครงการแล้วเผยแพร่ใหม่
- `.env.local`, dependency folders, build output และไฟล์ log ถูกกันออกจาก Git

## เอกสารอ้างอิง

- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [GitHub Actions ตัวอย่างสำหรับ Next.js Pages](https://github.com/actions/starter-workflows/blob/main/pages/nextjs.yml)
