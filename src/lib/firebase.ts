import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with long-polling enabled for stability in sandbox environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

// Connectivity Test
async function testConnection() {
  try {
    // Attempting to read a non-existent document from the server to verify connectivity
    // Using getDocFromServer ensures we aren't just hitting a local cache
    await getDocFromServer(doc(db, '_internal_', 'connectivity_test'));
    console.log('Firebase connection verified');
  } catch (error: any) {
    if (error.code === 'unavailable') {
      console.error("Firestore backend is unavailable. This may be due to project configuration or database not being created yet.");
    } else if (error.code === 'permission-denied') {
      console.log("Connection successful (got permission denied as expected for internal test path)");
    } else {
      console.warn("Firestore connectivity check:", error.message);
    }
  }
}

testConnection();
