import { Firestore } from '@google-cloud/firestore';
import { ExternalAccountClient, GoogleAuth } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';
import config from '../../firebase-applet-config.json';

/** This module is imported only by server routes. Never expose this credential to the browser. */
let database: Firestore | undefined;
export function serverFirestore() {
  if (database) return database;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || config.projectId;
  const raw = process.env.FIREBASE_SERVER_CREDENTIALS;
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER;
  const email = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  let options;
  if (raw) {
    const credentials = JSON.parse(raw);
    if (credentials.project_id !== projectId || !credentials.client_email || !credentials.private_key) throw new Error('Server database identity does not match this project');
    options = { credentials };
  } else {
    if (!provider || !email?.endsWith(`@${projectId}.iam.gserviceaccount.com`)) throw new Error('Server database identity is not configured');
    const client = ExternalAccountClient.fromJSON({
      type: 'external_account', audience: `//iam.googleapis.com/${provider}`,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt', token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`,
      subject_token_supplier: { getSubjectToken: getVercelOidcToken },
    });
    if (!client) throw new Error('Server federation configuration is invalid');
    client.scopes = ['https://www.googleapis.com/auth/datastore'];
    options = { auth: new GoogleAuth({ authClient: client, projectId, scopes: ['https://www.googleapis.com/auth/datastore'] }) };
  }
  database = new Firestore({ ...options, projectId, databaseId: config.firestoreDatabaseId || '(default)' });
  return database;
}
