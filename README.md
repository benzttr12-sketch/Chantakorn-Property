# CHANTAKORN PROPERTY

เว็บไซต์อสังหาริมทรัพย์ หาดใหญ่–สงขลา พัฒนาด้วย Next.js, TypeScript และ Tailwind CSS รองรับการรันบน Node.js และเผยแพร่ผ่าน GitHub Pages

## เริ่มใช้งานในเครื่อง

ใช้ Node.js 22 ขึ้นไป (แนะนำ Node.js 22 LTS) และ npm

```sh
npm ci
```

คัดลอก `.env.example` เป็น `.env.local` แล้วรัน:

```sh
npm run dev
```

เปิด http://localhost:3000

ค่าเริ่มต้น `NEXT_PUBLIC_DATA_BACKEND=local` ใช้รายการตัวอย่าง บันทึกรายการโปรดและข้อมูลทดลองเฉพาะเบราว์เซอร์นั้น ฟอร์มในโหมดนี้ไม่ได้ส่งข้อมูลถึงทีมงาน หากต้องการทดลองหลังบ้าน ให้ตั้ง `NEXT_PUBLIC_ENABLE_DEMO_AUTH=true` แล้วเข้า `/login` เพื่อเลือกบัญชีทดลอง ไม่มีการเข้าเป็นแอดมินให้อัตโนมัติ

## ตรวจสอบและ build

```sh
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

เปิด http://localhost:4173 ไฟล์สำหรับเผยแพร่อยู่ใน `out/` ไม่ต้อง commit โฟลเดอร์นี้

`build:pages` เลือกข้อมูลตัวอย่างและปิดล็อกอินทดลองโดยค่าเริ่มต้น แม้ในเครื่องมี `.env.local` สำหรับฐานข้อมูลจริง เพื่อให้ผลการ build สำหรับสาธารณะคาดเดาได้

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

## เชื่อมระบบใช้งานจริงด้วย Supabase

1. สร้าง Supabase project แล้วรัน `supabase/schema.sql` ตามด้วย `supabase/seed.sql` ใน SQL Editor (seed เพิ่มตัวแทน 2 คนสำหรับฟอร์ม ไม่เพิ่มรายการทรัพย์หรือลูกค้าปลอม)
2. ตั้ง `.env.local`:

```dotenv
NEXT_PUBLIC_DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
NEXT_PUBLIC_ENABLE_DEMO_AUTH=false
NEXT_PUBLIC_SITE_URL=https://YOUR_SITE
```

3. ตั้ง Supabase Authentication → URL Configuration ให้มี URL ของเว็บไซต์จริง และ URL redirect ที่ใช้ยืนยันอีเมล
4. สมัครผู้ใช้ผ่าน `/register` แล้วยืนยันอีเมล บัญชีใหม่เริ่มเป็น `USER`
5. เจ้าของ project กำหนดแอดมินใน SQL Editor ตามคำแนะนำท้าย `supabase/schema.sql`
6. ล็อกอินที่ `/login` แล้วเพิ่มทรัพย์จาก `/admin/properties/new`

บน GitHub ให้เพิ่ม **Settings → Secrets and variables → Actions**:

| ประเภท | ชื่อ | ค่า |
| --- | --- | --- |
| Variable | `DEPLOY_DATA_BACKEND` | `supabase` |
| Variable | `NEXT_PUBLIC_SUPABASE_URL` | URL ของ project |
| Secret | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public anon/publishable key |

จากนั้นรัน workflow ใหม่ ค่าที่ขึ้นต้น `NEXT_PUBLIC_` จะรวมอยู่ใน JavaScript สาธารณะ จึงใช้ได้เฉพาะ public key และต้องมี RLS ตาม schema ห้ามใช้ service-role key

ระบบจะรายงานข้อผิดพลาดเมื่อฐานข้อมูลอ่าน/บันทึกไม่ได้ และจะไม่แอบบันทึกในเครื่องแทน ฐานข้อมูลว่างจะแสดงว่าไม่พบรายการ รูปทรัพย์ในหลังบ้านรับ URL; รูปในฟอร์มฝากขายจำกัด 5 รูป รูปละ 5 MB และบีบอัดในเบราว์เซอร์ก่อนส่ง

### Firebase

ตั้ง `NEXT_PUBLIC_DATA_BACKEND=firebase` และค่า Firebase ใน `.env.example` จากนั้น deploy `firestore.rules` ไปยัง Firebase project ก่อนเปิดใช้งานจริง Rules อนุญาตให้สาธารณะอ่านเฉพาะทรัพย์ที่เผยแพร่และสร้าง inquiry สถานะ `new`; การอ่านข้อมูลส่วนตัวและแก้ข้อมูลหลังบ้านต้องเป็น `ADMIN` หรือ `AGENT` จากเอกสาร `profiles/{uid}` ที่ได้รับการป้องกัน

บัญชี Firebase ใหม่เริ่มด้วย role `USER` เสมอ ไม่มีการยกสิทธิ์จากชื่อโดเมนหรืออีเมลใน browser การตั้ง Admin คนแรกต้องทำจาก Firebase Console หรือ Admin SDK ที่เชื่อถือได้ โดยแก้ `profiles/{uid}.role` เป็น `ADMIN` หลังจากผู้ใช้นั้นสมัครและมี profile แล้ว หลังจากนั้น Admin สามารถเปลี่ยน role ของ profile ที่มีอยู่ผ่านหน้า `/admin/users`

หน้า `/admin/users` ไม่สร้างหรือลบบัญชี Firebase Authentication และไม่เปลี่ยนอีเมลสำหรับเข้าสู่ระบบ เพราะการแก้ profile document อย่างเดียวไม่ใช่การจัดการ Auth account ให้สร้าง ลบ หรือเปลี่ยนอีเมลบัญชีผ่าน Firebase Authentication Console/Admin SDK แล้วใช้หน้านี้จัดการชื่อ เบอร์โทร และ role ของ profile

ค่าที่กำหนดใน `NEXT_PUBLIC_DATA_BACKEND` เป็นตัวเลือกหลักเสมอ หากเลือก backend ที่ยังตั้งค่าไม่ครบ ระบบจะแสดงข้อผิดพลาดแทนการสลับไปใช้ backend อื่นหรือข้อมูล local โดยเงียบ ๆ

## ขอบเขตข้อมูล

- รายการตัวอย่าง ภาพ และข้อความรีวิวเป็นข้อมูลสาธิต ควรตรวจและแทนที่ข้อมูลติดต่อ/ทรัพย์ก่อนใช้งานธุรกิจจริง
- โหมด local แยกข้อมูลตามเบราว์เซอร์ ไม่มีฐานข้อมูลส่วนกลาง และล้างข้อมูลเว็บไซต์แล้วข้อมูลทดลองจะหาย
- Favorites เก็บในเบราว์เซอร์
- หน้าข้อมูลระบบแสดงโหมดที่เลือก การเปลี่ยนข้อมูลติดต่อหรือฐานข้อมูลต้องแก้โครงการแล้วเผยแพร่ใหม่
- การติดตั้ง schema และทดสอบกับ Supabase project จริงต้องทำก่อนเปิดรับข้อมูลลูกค้าจริง
- `.env.local`, dependency folders, build output และไฟล์ log ถูกกันออกจาก Git

## เอกสารอ้างอิง

- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [GitHub Actions ตัวอย่างสำหรับ Next.js Pages](https://github.com/actions/starter-workflows/blob/main/pages/nextjs.yml)
