import crypto from 'node:crypto';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

const DEFAULT_PROJECT_ID = 'gen-lang-client-0299720065';
const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-noirscrolldriven-f315def4-d182-4618-969f-6da452cde3b7';

let adminApp: App | null = null;

export function normalizePrivateKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  let k = rawKey.trim();

  // Strip surrounding quotes (double or single)
  while (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }

  // Handle escaped quotes inside string
  k = k.replace(/\\"/g, '"').replace(/\\'/g, "'");

  // Handle literal escaped backslash-n sequences (\n or \\n) and carriage returns
  k = k.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '');

  // If there are no PEM headers at all, wrap it
  if (!k.includes('-----BEGIN')) {
    const cleanBase64 = k.replace(/[\s\r\n]/g, '');
    const chunked = cleanBase64.match(/.{1,64}/g)?.join('\n') || cleanBase64;
    k = `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----\n`;
  } else {
    // Standardize existing PEM headers
    const headerMatch = k.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----/);
    const footerMatch = k.match(/-----END (?:RSA )?PRIVATE KEY-----/);
    if (headerMatch && footerMatch) {
      const header = headerMatch[0];
      const footer = footerMatch[0];
      const startIdx = k.indexOf(header) + header.length;
      const endIdx = k.indexOf(footer);
      const innerBase64 = k.slice(startIdx, endIdx).replace(/[\s\r\n]/g, '');
      const chunked = innerBase64.match(/.{1,64}/g)?.join('\n') || innerBase64;
      k = `${header}\n${chunked}\n${footer}\n`;
    }
  }

  return k;
}

export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;

  // 1. Full JSON Service Account Key string in env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      let saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      while (
        (saRaw.startsWith('"') && saRaw.endsWith('"')) ||
        (saRaw.startsWith("'") && saRaw.endsWith("'"))
      ) {
        saRaw = saRaw.slice(1, -1).trim();
      }
      const serviceAccount = JSON.parse(saRaw);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = normalizePrivateKey(serviceAccount.private_key);
        // Pre-validate with Node crypto
        crypto.createPrivateKey(serviceAccount.private_key);
      }
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      return adminApp;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Firebase Admin]: Service account key string format issue, attempting individual key variables:', msg);
    }
  }

  // 2. Individual Client Email and Private Key in env
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      // Pre-validate with Node crypto to gracefully catch any invalid key before cert()
      crypto.createPrivateKey(privateKey);

      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
          privateKey,
        }),
        projectId,
      });
      return adminApp;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Firebase Admin]: Private key pre-validation notice:', msg);
    }
  }

  // 3. Fallback: Project-only initialization or resilient local mode
  try {
    adminApp = initializeApp({
      projectId,
    });
    return adminApp;
  } catch (err) {
    adminApp = initializeApp({ projectId }, 'atelier-noire-admin');
    return adminApp;
  }
}

let cachedDb: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  const app = getAdminApp();
  const dbId = process.env.FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;
  
  if (dbId && dbId !== '(default)') {
    try {
      cachedDb = getFirestore(app, dbId);
    } catch {
      cachedDb = getFirestore(app);
    }
  } else {
    cachedDb = getFirestore(app);
  }

  try {
    cachedDb.settings({ ignoreUndefinedProperties: true });
  } catch {
    // In case settings were already initialized
  }

  return cachedDb;
}

export function getAdminAuth(): Auth {
  const app = getAdminApp();
  return getAuth(app);
}
