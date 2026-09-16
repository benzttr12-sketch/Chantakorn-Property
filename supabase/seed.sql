-- Run AFTER schema.sql in the Supabase SQL Editor.
-- These IDs match src/data/agents.ts and the property editor's agent selector.
-- Existing rows are preserved. Review/update the public contact details before
-- going live. No sample listings, customer inquiries, or privileged accounts are created.

begin;
insert into public.agents (id, name, title, phone, line_id, facebook, email, photo_url, bio)
values
  (
    'a1111111-1111-1111-1111-111111111111',
    'คุณฉันทากร นวลจันทร์ (เบนซ์)',
    'ผู้ก่อตั้งและที่ปรึกษาอสังหาริมทรัพย์อาวุโส',
    '081-604-0097',
    'LINE Official Account',
    'https://www.facebook.com/people/Chantakorn-Property-%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2-%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99-%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%94%E0%B8%B4%E0%B8%99-%E0%B8%84%E0%B8%AD%E0%B8%99%E0%B9%82%E0%B8%94-%E0%B8%AB%E0%B8%B2%E0%B8%94%E0%B9%83%E0%B8%AB%E0%B8%8D%E0%B9%88-%E0%B8%AA%E0%B8%87%E0%B8%82%E0%B8%A5%E0%B8%B2/61593092347613/',
    'chantakorn@chantakornproperty.com',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
    'ประสบการณ์ด้านอสังหาริมทรัพย์ในพื้นที่หาดใหญ่-สงขลากว่า 10 ปี เชี่ยวชาญการประเมินราคา การเจรจาต่อรอง และการประสานงานสินเชื่อธนาคาร ดูแลลูกค้าทุกท่านอย่างซื่อตรงและโปร่งใส'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'คุณพิมลภัส สุวรรณรัตน์ (พิม)',
    'ผู้เชี่ยวชาญด้านบ้านเดี่ยวและคอนโดมิเนียม ม.อ.หาดใหญ่',
    '089-876-5432',
    'LINE Official Account',
    'Pim Chantakorn Property',
    'pimonpat@chantakornproperty.com',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    'ให้คำปรึกษาในการเลือกซื้อบ้านและคอนโดเพื่ออยู่อาศัยและการลงทุน ดูแลตั้งแต่การพานัดชมทรัพย์จนถึงวันโอนกรรมสิทธิ์ ณ กรมที่ดิน'
  )
on conflict (id) do nothing;
commit;
