import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc } from 'firebase/firestore';

let env;
const date = '2026-09-20T00:00:00.000Z';
const profile = (id, role = 'USER') => ({ id, full_name: id, email: `${id}@example.com`, role, created_at: date });
const property = (id, published = true) => ({ id, title: 'Test property', slug: id, description: 'Test description', property_type: 'house', status: 'sale', price: 100, province: 'สงขลา', district: 'หาดใหญ่', latitude: 7, longitude: 100, bedrooms: 1, bathrooms: 1, parking: 0, land_size: 10, usable_area: 10, furniture: '', features: [], cover_image: 'https://example.com/image.jpg', images: ['https://example.com/image.jpg'], featured: false, published, created_at: date });
const inquiry = id => ({ id, name: 'Visitor', phone: '0810000000', message: 'Please contact me', inquiry_type: 'inquiry', status: 'new', created_at: date });
const database = uid => uid ? env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore() : env.unauthenticatedContext().firestore();

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-chantakorn', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      ...['admin', 'agent', 'member'].map(id => setDoc(doc(db, 'profiles', id), profile(id, id === 'admin' ? 'ADMIN' : id === 'agent' ? 'AGENT' : 'USER'))),
      setDoc(doc(db, 'properties', 'public'), property('public')),
      setDoc(doc(db, 'properties', 'draft'), property('draft', false)),
    ]);
  });
});
after(async () => { await env?.cleanup(); });

test('public catalog only exposes published properties and denies writes', async () => {
  const db = database();
  await assertSucceeds(getDocs(query(collection(db, 'properties'), where('published', '==', true))));
  await assertFails(getDocs(collection(db, 'properties')));
  await assertFails(getDoc(doc(db, 'properties', 'draft')));
  await assertFails(setDoc(doc(db, 'properties', 'hacked'), property('hacked')));
});
test('staff can create/edit/delete valid properties; schema and immutable fields protected', async () => {
  const db = database('agent');
  await assertSucceeds(getDocs(collection(db, 'properties')));
  await assertSucceeds(setDoc(doc(db, 'properties', 'staff-property'), property('staff-property')));
  await assertSucceeds(updateDoc(doc(db, 'properties', 'staff-property'), { price: 200 }));
  await assertSucceeds(updateDoc(doc(db, 'properties', 'staff-property'), { images: Array(20).fill('https://example.com/image.jpg'), features: Array(20).fill('เครื่องปรับอากาศ') }));
  await assertSucceeds(updateDoc(doc(db, 'properties', 'staff-property'), { subdistrict: 'ควนลัง', address: 'Test address', year_built: 2024, updated_at: date, agent_id: 'business-agent', agent: { id: 'business-agent', name: 'Agent', title: 'Staff', phone: '0810000000', line_id: 'agent', email: 'agent@example.com', photo_url: 'https://example.com/photo.jpg', bio: 'Business contact', facebook: '' } }));
  await assertFails(updateDoc(doc(db, 'properties', 'staff-property'), { id: 'changed' }));
  await assertFails(updateDoc(doc(db, 'properties', 'staff-property'), { images: ['javascript:alert(1)'] }));
  await assertFails(updateDoc(doc(db, 'properties', 'staff-property'), { images: ['https://example.com/image.jpg', 42] }));
  await assertSucceeds(deleteDoc(doc(db, 'properties', 'staff-property')));
  await assertFails(setDoc(doc(database('member'), 'properties', 'member-property'), property('member-property')));
});
test('profile ownership never grants role escalation or private directory access', async () => {
  const db = database('newmember');
  await assertFails(setDoc(doc(db, 'profiles', 'newmember'), profile('newmember', 'ADMIN')));
  await assertSucceeds(setDoc(doc(db, 'profiles', 'newmember'), profile('newmember')));
  await assertSucceeds(updateDoc(doc(db, 'profiles', 'newmember'), { full_name: 'Updated', phone: '0810000000' }));
  await assertFails(updateDoc(doc(db, 'profiles', 'newmember'), { role: 'ADMIN' }));
  await assertFails(updateDoc(doc(db, 'profiles', 'newmember'), { email: 'other@example.com' }));
  await assertFails(getDoc(doc(db, 'profiles', 'admin')));
  await assertFails(getDocs(collection(db, 'profiles')));
  await assertFails(getDocs(collection(database('agent'), 'profiles')));
});
test('admin manages other roles but cannot remove own access or create fake accounts', async () => {
  const db = database('admin');
  await assertSucceeds(getDocs(collection(db, 'profiles')));
  await assertSucceeds(updateDoc(doc(db, 'profiles', 'member'), { role: 'AGENT' }));
  await assertSucceeds(updateDoc(doc(db, 'profiles', 'member'), { role: 'USER' }));
  await assertFails(updateDoc(doc(db, 'profiles', 'admin'), { role: 'USER' }));
  await assertFails(setDoc(doc(db, 'profiles', 'fake'), profile('fake')));
  await assertFails(deleteDoc(doc(db, 'profiles', 'member')));
});
test('public inquiry creation cannot expose inbox or forge status; staff may update status only', async () => {
  const db = database();
  await assertSucceeds(setDoc(doc(db, 'inquiries', 'lead'), inquiry('lead')));
  await assertFails(getDoc(doc(db, 'inquiries', 'lead')));
  await assertFails(getDocs(collection(database('member'), 'inquiries')));
  await assertFails(setDoc(doc(db, 'inquiries', 'forged'), { ...inquiry('forged'), status: 'closed' }));
  await assertFails(setDoc(doc(db, 'inquiries', 'oversize'), { ...inquiry('oversize'), message: 'x'.repeat(5001) }));
  const staff = database('agent');
  await assertSucceeds(getDoc(doc(staff, 'inquiries', 'lead')));
  await assertSucceeds(updateDoc(doc(staff, 'inquiries', 'lead'), { status: 'contacted' }));
  await assertFails(updateDoc(doc(staff, 'inquiries', 'lead'), { phone: 'modified' }));
});
test('consignment attachments are bounded and inquiry property references are checked', async () => {
  const db = database();
  const details = { property_type: 'house', province: 'สงขลา', district: 'หาดใหญ่', expected_price: 100, photos: ['data:image/jpeg;base64,YWJj'], photos_count: 1 };
  await assertSucceeds(setDoc(doc(db, 'inquiries', 'consign'), { ...inquiry('consign'), inquiry_type: 'consignment_sell', consignment_details: details }));
  await assertFails(setDoc(doc(db, 'inquiries', 'badphoto'), { ...inquiry('badphoto'), inquiry_type: 'consignment_sell', consignment_details: { ...details, photos: [42] } }));
  await assertSucceeds(setDoc(doc(db, 'inquiries', 'view'), { ...inquiry('view'), inquiry_type: 'viewing', property_id: 'public', property_title: 'Test property' }));
  await assertFails(setDoc(doc(db, 'inquiries', 'viewdraft'), { ...inquiry('viewdraft'), inquiry_type: 'viewing', property_id: 'draft', property_title: 'Test property' }));
  await assertFails(setDoc(doc(db, 'unknown', 'anything'), { open: true }));
});
