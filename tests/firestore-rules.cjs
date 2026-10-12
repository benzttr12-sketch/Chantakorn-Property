const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, query, where } = require('firebase/firestore');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const test = await initializeTestEnvironment({ projectId: 'demo-chantakorn-security', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
  try {
    await test.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'profiles', 'admin'), { role: 'ADMIN' });
      await setDoc(doc(db, 'profiles', 'agent'), { role: 'AGENT' });
      await setDoc(doc(db, 'profiles', 'user'), { role: 'USER' });
      await setDoc(doc(db, 'properties', 'published'), { published: true, internal_notes: 'PRIVATE' });
      await setDoc(doc(db, 'properties', 'draft'), { published: false, internal_notes: 'PRIVATE' });
    });
    for (const context of [test.unauthenticatedContext(), test.authenticatedContext('user', {email_verified:true}), test.authenticatedContext('admin', {email_verified:false})]) {
      const db = context.firestore();
      await assertFails(getDoc(doc(db, 'properties', 'draft')));
      await assertFails(getDoc(doc(db, 'properties', 'published')));
      await assertFails(getDocs(query(collection(db, 'properties'), where('published','==',true))));
      await assertFails(setDoc(doc(db, 'line_followers', 'spoofed'), {user_id:'attacker',is_active:true}));
      await assertFails(setDoc(doc(db, 'inquiries', 'spam'), {name:'Spam'}));
      await assertFails(getDoc(doc(db, 'inquiry_media', 'private-photo')));
      await assertFails(getDoc(doc(db, 'request_budgets', 'global')));
    }
    for (const user of ['admin', 'agent']) {
      const db=test.authenticatedContext(user,{email_verified:true}).firestore();
      assert.equal((await assertSucceeds(getDoc(doc(db,'properties','draft')))).data().internal_notes,'PRIVATE');
      await assertSucceeds(setDoc(doc(db,'properties',`new-${user}`),{published:false,internal_notes:'Still private'}));
      await assertSucceeds(setDoc(doc(db,'property_media',`media-${user}`),{property_id:`new-${user}`,data_url:'data:image/jpeg;base64,YQ==',created_at:'2026-10-11'}));
      await assertFails(setDoc(doc(db,'property_media',`media-${user}`),{property_id:'changed',data_url:'data:image/jpeg;base64,YQ==',created_at:'2026-10-11'}));
      await assertSucceeds(getDoc(doc(db,'inquiry_media','photo')));
      await assertFails(setDoc(doc(db,'line_followers','spoofed'),{user_id:'attacker'}));
    }
    console.log('Firestore rules: anonymous/ordinary/unverified denied; verified staff workflows passed.');
  } finally { await test.cleanup(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
