# CHANTAKORN PROPERTY

เว็บไซต์อสังหาริมทรัพย์ Next.js / TypeScript เชื่อม Firebase Authentication และ Cloud Firestore

## ฐานข้อมูลที่ใช้งาน

- Project: `chantakorn-property-2026`
- Database: `chantakorn` — Enterprise Native, realtime enabled
- Region: `asia-southeast1` (สิงคโปร์)
- Web SDK configuration: `firebase.web.json` เป็น public configuration ไม่ใช่ service-account key
- `.firebaserc` และ `firebase.json` เลือกโปรเจกต์และฐานข้อมูลเดียวกัน

ข้อมูลทรัพย์ ข้อความติดต่อ และโปรไฟล์ใช้ฐานข้อมูลจริง ไม่มีการเติมข้อมูลตัวอย่างหรือบัญชีแอดมินอัตโนมัติ ฐานข้อมูลว่างจะแสดงรายการว่าง หากอ่าน/เขียนล้มเหลวจะแสดงข้อผิดพลาด

## รันและตรวจสอบ

ใช้ Node.js 22 ขึ้นไป:

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build:pages
npm run preview:pages
```

เปิด dev ที่ http://localhost:3000 หรือ static preview ที่ http://localhost:4173

ไม่ต้องตั้งค่า Firebase เพิ่มเพื่อใช้โปรเจกต์นี้ หากต้องการเปลี่ยนโปรเจกต์ ให้ตั้งค่าครบตาม `.env.example` และเปลี่ยน CLI project/database ให้ตรงกัน อย่าใส่ private key ในตัวแปร `NEXT_PUBLIC_*`

`NEXT_PUBLIC_DATA_BACKEND=local` เป็นโหมดดูตัวอย่างแบบอ่านอย่างเดียว ไม่มีบัญชีทดลองและไม่ส่งข้อความถึงทีมงาน Favorites เก็บเฉพาะเบราว์เซอร์

## บัญชีและสิทธิ์

สมัครผ่าน `/register` หรือ Google ที่ `/login` บัญชีใหม่ได้รับสิทธิ์ `USER` เท่านั้น

แอดมินคนแรก: เจ้าของ Firebase project ต้องตรวจสอบบัญชีที่สมัครจริงใน Authentication และแก้ `role` ของเอกสาร `profiles/<Authentication UID>` ในฐานข้อมูล `chantakorn` เป็น `ADMIN` ผ่าน Firebase Console จากนั้นระบบจะรับสิทธิ์ใหม่ทันที ห้ามสร้าง UID สมมติหรือกำหนดสิทธิ์จากโดเมนอีเมล

- USER: ดูทรัพย์ที่เผยแพร่และแก้โปรไฟล์ตัวเอง
- AGENT: จัดการรายการทรัพย์และกล่องข้อความของทีม
- ADMIN: สิทธิ์พนักงาน และจัดการชื่อ/โทรศัพท์/บทบาทของสมาชิกที่สมัครแล้ว
- ไม่อนุญาตให้แอดมินลดสิทธิ์ตัวเองจากหน้าเว็บ
- การลบบัญชีหรือแก้อีเมลเข้าสู่ระบบต้องทำผ่าน Firebase Authentication โดยเจ้าของโปรเจกต์

ใช้ SDK query แบบปกติเพื่อให้การอ่านข้อมูลใช้ Security Rules และคง realtime listener สำหรับการเปลี่ยนสิทธิ์ โปรไฟล์และข้อความติดต่อไม่เปิดอ่านสาธารณะ

## รูปภาพ

รูปทรัพย์และรูปโปรไฟล์ใช้ URL HTTPS โดยค่าเริ่มต้น (รูปทรัพย์ไม่เกิน 20 รูป) การอัปโหลดผ่าน Cloud Storage ต้องเปิด Blaze และสร้าง bucket ก่อน แล้วตั้ง `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` และ deploy `storage.rules` ด้วย configuration ของ bucket นั้น ไม่มีการเรียก Cloud Function ที่ยังไม่ได้สร้าง

รูปแนบฝากขายยังรองรับการบีบอัด JPEG สูงสุด 5 รูป รูปละ 125,000 ตัวอักษร และเก็บอยู่ใน inquiry ส่วนตัว ไม่เปิดอ่านสาธารณะ

## Security Rules และการทดสอบ

```sh
npx -y firebase-tools@latest deploy --only firestore,auth --project chantakorn-property-2026
```

ทดสอบการป้องกันสิทธิ์ใน Emulator (ต้องมี Java 21+ อยู่ใน PATH):

```sh
npm run test:rules
```

ชุดทดสอบตรวจ public/draft visibility, staff CRUD, profile privacy, role escalation, admin self-lockout, inbox privacy และข้อมูลฟอร์มที่ไม่ถูกต้อง ควรตรวจทบทวน Rules และบัญชีพนักงานก่อนเปิดให้ผู้ใช้ทั่วไปใช้งานในวงกว้าง

## GitHub Pages

Workflow `.github/workflows/pages.yml` ใช้ `npm ci` พร้อม lockfile ตรวจ lint/types/tests แล้ว build โดยเลือก Firebase เสมอ เมื่อ push ไป `main` จะ deploy ผ่าน GitHub Actions ตามการตั้งค่า Pages ของ repository

ทรัพย์ที่เพิ่มภายหลังเปิดผ่าน `/properties/detail/?slug=...` โดยไม่ต้อง build ใหม่ หน้า slug เก่าของตัวอย่างยังเปิดได้แต่ไม่แสดงข้อมูลตัวอย่างในโหมด Firebase

ไฟล์ build อยู่ใน `out/` และไม่ต้อง commit เอกสาร `.env.local`, logs, dependencies และ build outputs ถูกกันออกจาก Git ข้อมูลติดต่อทีมงานและเนื้อหาสาธิตในหน้าแนะนำยังควรตรวจทานก่อนใช้งานธุรกิจจริง
