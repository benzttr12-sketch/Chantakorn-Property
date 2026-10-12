const test = require('node:test');
const assert = require('node:assert/strict');
const google = require('google-auth-library');
const loader = require('./load-ts.cjs');
const config = require('../firebase-applet-config.json');

const provider = 'projects/123456789/locations/global/workloadIdentityPools/vercel/providers/vercel';
const federationEnv = (projectId = config.projectId) => ({
  GCP_WORKLOAD_IDENTITY_PROVIDER: provider,
  GCP_SERVICE_ACCOUNT_EMAIL: `firestore-server@${projectId}.iam.gserviceaccount.com`,
});
const claims = { iss: 'https://oidc.vercel.com/benz-ca8e', aud: 'https://vercel.com/benz-ca8e',
  sub: 'owner:benz-ca8e:project:chantakorn-property:environment:preview', private_claim: 'never-log-this' };
const token = `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

function harness(env, { nullClient = false } = {}) {
  const clients = [], instances = [], tokenArguments = [], logs = [];
  class Firestore {
    constructor(options) { this.options = options; instances.push(this); }
  }
  const load = loader({
    '@google-cloud/firestore': { Firestore },
    'google-auth-library': {
      GoogleAuth: google.GoogleAuth,
      ExternalAccountClient: { fromJSON: options => {
        if (nullClient) return null;
        const client = google.ExternalAccountClient.fromJSON(options);
        clients.push(client);
        return client;
      } },
    },
    '@vercel/oidc': { getVercelOidcToken: async (...args) => { tokenArguments.push(args); return token; } },
  }, { process: { env }, console: { info: (...args) => logs.push(args) } });
  return { api: load('lib/server-firestore.ts'), clients, instances, tokenArguments, logs };
}

test('the Google SDK passes its provider audience to subject suppliers as retrieval context', async () => {
  const received = [];
  const audience = `//iam.googleapis.com/${provider}`;
  const client = google.ExternalAccountClient.fromJSON({
    type: 'external_account', audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    subject_token_supplier: { getSubjectToken: async context => { received.push(context); return token; } },
  });
  assert.equal(await client.retrieveSubjectToken(), token);
  assert.equal(received.length, 1);
  assert.equal(received[0].audience, audience);
  assert.equal(received[0].subjectTokenType, 'urn:ietf:params:oauth:token-type:jwt');
  assert.ok(received[0].transporter);
});

test('the Firestore supplier ignores Google context and requests the default Vercel audience without arguments', async () => {
  const h = harness(federationEnv());
  const db = h.api.serverFirestore();
  assert.equal(h.instances.length, 1);
  assert.equal(db.options.projectId, config.projectId);
  assert.equal(db.options.databaseId, config.firestoreDatabaseId);
  assert.equal(h.api.serverFirestore(), db, 'the initialized named database is reused');
  assert.equal(h.clients.length, 1);
  assert.equal(await h.clients[0].retrieveSubjectToken(), token);
  assert.deepEqual(h.tokenArguments, [[]], 'passing Google audience into Vercel options would request a custom audience');
  assert.deepEqual(Array.from(h.clients[0].scopes), ['https://www.googleapis.com/auth/datastore']);
  assert.equal(h.logs.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.logs[0][1])), { issuer: claims.iss, audience: claims.aud, subject: claims.sub });
  assert.equal(JSON.stringify(h.logs).includes(token), false);
  assert.equal(JSON.stringify(h.logs).includes(claims.private_claim), false);
});

test('an explicit Firebase project uses that project identity and keeps the configured named database', () => {
  const projectId = 'explicit-project';
  const h = harness({ ...federationEnv(projectId), NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId });
  const db = h.api.serverFirestore();
  assert.equal(db.options.projectId, projectId);
  assert.equal(db.options.databaseId, config.firestoreDatabaseId);
  assert.equal(h.clients[0].getServiceAccountEmail(), `firestore-server@${projectId}.iam.gserviceaccount.com`);
});

test('missing, mismatched or malformed server identity configuration fails closed before constructing Firestore', () => {
  for (const env of [
    {}, { GCP_WORKLOAD_IDENTITY_PROVIDER: provider },
    { ...federationEnv(), GCP_SERVICE_ACCOUNT_EMAIL: 'server@other-project.iam.gserviceaccount.com' },
    { ...federationEnv(), FIREBASE_SERVER_CREDENTIALS: '{' },
    { ...federationEnv(), FIREBASE_SERVER_CREDENTIALS: JSON.stringify({ project_id: 'other-project', client_email: 'server@example.com', private_key: 'dummy-key' }) },
    { ...federationEnv(), FIREBASE_SERVER_CREDENTIALS: JSON.stringify({ project_id: config.projectId, client_email: 'server@example.com' }) },
  ]) {
    const h = harness(env);
    assert.throws(() => h.api.serverFirestore());
    assert.equal(h.instances.length, 0);
    assert.equal(h.tokenArguments.length, 0);
  }
  const invalidFederation = harness(federationEnv(), { nullClient: true });
  assert.throws(() => invalidFederation.api.serverFirestore(), /federation configuration is invalid/);
  assert.equal(invalidFederation.instances.length, 0);
});

test('matching explicit credentials select the named project database without retrieving a Vercel token', () => {
  const credentials = { project_id: config.projectId,
    client_email: `firestore-server@${config.projectId}.iam.gserviceaccount.com`, private_key: 'dummy-key-for-constructor-test' };
  const h = harness({ FIREBASE_SERVER_CREDENTIALS: JSON.stringify(credentials) });
  const db = h.api.serverFirestore();
  assert.equal(db.options.projectId, config.projectId);
  assert.equal(db.options.databaseId, config.firestoreDatabaseId);
  assert.deepEqual(JSON.parse(JSON.stringify(db.options.credentials)), credentials);
  assert.equal(h.clients.length, 0);
  assert.equal(h.tokenArguments.length, 0);
});
