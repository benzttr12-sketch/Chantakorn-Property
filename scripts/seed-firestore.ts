import { SAMPLE_PROPERTIES } from '../src/data/sample-properties';
import appletConfig from '../firebase-applet-config.json';
import https from 'node:https';

const apiKey = appletConfig.apiKey;
const dbPath = `projects/${appletConfig.projectId}/databases/${appletConfig.firestoreDatabaseId}`;

function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function putDoc(collection: string, docId: string, data: any) {
  return new Promise((resolve, reject) => {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    const postData = JSON.stringify({ fields });
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/${dbPath}/documents/${collection}/${docId}?key=${apiKey}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`Failed with ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log(`Seeding ${SAMPLE_PROPERTIES.length} properties into Firestore...`);
  for (const prop of SAMPLE_PROPERTIES) {
    await putDoc('properties', prop.id, prop);
    console.log(`Seeded property: ${prop.id} - ${prop.title.slice(0, 30)}`);
  }
  console.log('Seeding completed successfully!');
}

main().catch(console.error);
