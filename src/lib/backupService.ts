import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  setDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';

export const COLLECTIONS = [
  'users',
  'products',
  'customers',
  'suppliers',
  'invoices',
  'purchases',
  'expenses',
  'productions',
  'categories',
  'stockMovements',
  'activityLogs'
];

export async function getBackupData(onProgress?: (p: number, msg: string) => void) {
  const backup: Record<string, any[]> = {};
  let processed = 0;
  
  for (const collectionName of COLLECTIONS) {
    onProgress?.((processed / COLLECTIONS.length) * 100, `Exporting ${collectionName}...`);
    const snapshot = await getDocs(collection(db, collectionName));
    backup[collectionName] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    processed++;
  }
  
  onProgress?.(100, 'Data preparation complete');
  
  return {
    version: '1.1',
    timestamp: new Date().toISOString(),
    exportedBy: auth.currentUser?.email,
    data: backup
  };
}

export async function restoreBackup(backupData: any, onProgress?: (p: number, msg: string) => void) {
  // Gracefully handle both the wrapped format { version, data: { ... } } 
  // and the raw format { products: [], ... }
  const data = backupData.data && typeof backupData.data === 'object' && !Array.isArray(backupData.data)
    ? backupData.data 
    : backupData;
  
  let processed = 0;
  for (const collectionName of COLLECTIONS) {
    const p = (processed / COLLECTIONS.length) * 100;
    
    if (!data[collectionName]) {
      processed++;
      continue;
    }
    
    onProgress?.(p, `Restoring ${collectionName}...`);
    const items = data[collectionName];
    
    // Process in batches of 500 (Firestore limit)
    for (let i = 0; i < items.length; i += 500) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 500);
      
      chunk.forEach((item: any) => {
        const { id, ...rest } = item;
        const ref = doc(db, collectionName, id);
        batch.set(ref, rest);
      });
      
      await batch.commit();
    }
    processed++;
  }
  onProgress?.(100, 'Restore complete');
}

export async function saveBackupMetadata(type: 'local' | 'drive', size: number) {
  const metadataRef = doc(db, 'backupMetadata', 'last_backup');
  await setDoc(metadataRef, {
    lastBackupAt: new Date().toISOString(),
    lastBackupEmail: auth.currentUser?.email,
    size,
    type,
    status: 'success'
  });
}
