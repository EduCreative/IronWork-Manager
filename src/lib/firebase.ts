import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Support both root-relative and directory-relative patterns for maximum compatibility
const configFiles = import.meta.glob('/firebase-applet-*.json', { eager: true });
const fallbackConfigFiles = import.meta.glob('../../firebase-applet-*.json', { eager: true });

const mergedConfigFiles = { ...configFiles, ...fallbackConfigFiles };
console.log('[Firebase Init] Globbed config files found:', Object.keys(mergedConfigFiles));
console.log('[Firebase Init] Globbed modules:', mergedConfigFiles);

const configKey = Object.keys(mergedConfigFiles)[0];
const localConfig = configKey ? (mergedConfigFiles[configKey] as any).default || mergedConfigFiles[configKey] : {};
console.log('[Firebase Init] Extracted localConfig:', localConfig);

const getLocalStorageValue = (key: string): string | null => {
  try {
    const val = localStorage.getItem(key);
    if (!val || val === 'undefined' || val === 'null' || val.trim() === '') {
      return null;
    }
    return val;
  } catch (e) {
    return null;
  }
};

export const setLocalStorageOverride = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('Failed to set localStorage override:', e);
  }
};

export const clearLocalStorageOverrides = () => {
  try {
    localStorage.removeItem('FIREBASE_API_KEY');
    localStorage.removeItem('FIREBASE_AUTH_DOMAIN');
    localStorage.removeItem('FIREBASE_PROJECT_ID');
    localStorage.removeItem('FIREBASE_STORAGE_BUCKET');
    localStorage.removeItem('FIREBASE_MESSAGING_SENDER_ID');
    localStorage.removeItem('FIREBASE_APP_ID');
    localStorage.removeItem('FIREBASE_DATABASE_ID');
  } catch (e) {
    console.error('Failed to clear localStorage overrides:', e);
  }
};

const cleanStringValue = (val: any): string | null => {
  if (typeof val !== 'string') return null;
  let s = val.trim();
  // Clean up any double or single quotes wrapping the key/value due to copy-paste or platform var quoting
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1).trim();
  }
  return s || null;
};

const getFirebaseValue = (key: string, envVal: any, localVal: any): string => {
  const overridden = getLocalStorageValue(key);
  if (overridden) return overridden;
  
  const localStr = cleanStringValue(localVal);
  if (localStr) return localStr;
  
  const envStr = cleanStringValue(envVal);
  if (envStr) return envStr;
  
  return '';
};

export const firebaseConfig = {
  apiKey: getFirebaseValue('FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY, localConfig.apiKey),
  authDomain: getFirebaseValue('FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, localConfig.authDomain),
  projectId: getFirebaseValue('FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID, localConfig.projectId),
  storageBucket: getFirebaseValue('FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, localConfig.storageBucket),
  messagingSenderId: getFirebaseValue('FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, localConfig.messagingSenderId),
  appId: getFirebaseValue('FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID, localConfig.appId),
  firestoreDatabaseId: getFirebaseValue('FIREBASE_DATABASE_ID', import.meta.env.VITE_FIREBASE_DATABASE_ID, localConfig.firestoreDatabaseId) || '(default)',
};

// Log loaded safe details for runtime debugging
console.log('[Firebase Init] Current Project:', firebaseConfig.projectId);
console.log('[Firebase Init] Active Database Instance:', firebaseConfig.firestoreDatabaseId);
console.log('[Firebase Init] Api Key configured:', firebaseConfig.apiKey ? 'YES' : 'NO');

export let app: any = null;
export let db: any = null;
export let auth: any = null;
export let initError: string | null = null;

try {
  // Only attempt initialization if API key is provided, otherwise raise a descriptive error
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase API Key is missing or empty. Please configure it in the settings below.');
  }
  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
} catch (error: any) {
  initError = error.message || String(error);
  console.error('[Firebase Init] Critical error during Firebase initialization:', error);
}

export type FirestoreConnectionStatus = 'checking' | 'connected' | 'unavailable' | 'permission-denied' | 'error';
export let firestoreStatus: FirestoreConnectionStatus = 'checking';
export let firestoreErrorDetails = '';

// Connectivity Test
export async function testConnection() {
  if (initError || !db) {
    firestoreStatus = 'error';
    firestoreErrorDetails = initError || 'Firebase not initialized';
    return;
  }
  try {
    // Attempting to read a non-existent document from the server to verify connectivity
    // Using getDocFromServer ensures we aren't just hitting a local cache
    await getDocFromServer(doc(db, '_internal_', 'connectivity_test'));
    console.log('[Firebase Init] Connection verified successfully');
    firestoreStatus = 'connected';
  } catch (error: any) {
    firestoreErrorDetails = error.message || String(error);
    if (error.code === 'unavailable') {
      firestoreStatus = 'unavailable';
      console.error("[Firebase Init] Firestore backend is unavailable. This may be due to project configuration or database not being created yet.");
    } else if (error.code === 'permission-denied') {
      firestoreStatus = 'permission-denied';
      console.log("[Firebase Init] Connection successful (got permission denied as expected for internal test path)");
    } else {
      firestoreStatus = 'error';
      console.warn("[Firebase Init] Firestore connectivity check:", error.message);
    }
  }
}

// Only test connection if successfully initialized
if (db) {
  testConnection();
} else {
  firestoreStatus = 'error';
  firestoreErrorDetails = initError || 'Firebase DB initialization skipped due to load error';
}
