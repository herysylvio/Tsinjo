import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface SyncOperation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  payload: Record<string, any>;
  createdAt: number;
}

interface TsinjoOfflineDB extends DBSchema {
  cache: {
    key: string;
    value: {
      key: string;
      data: any;
      updatedAt: number;
    };
  };
  syncQueue: {
    key: string;
    value: SyncOperation;
    indexes: { 'by-createdAt': number };
  };
}

let dbPromise: Promise<IDBPDatabase<TsinjoOfflineDB>> | null = null;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<TsinjoOfflineDB>('tsinjo-offline', 1, {
      upgrade(db) {
        db.createObjectStore('cache', { keyPath: 'key' });
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
};

// Cache operations
export const cacheGet = async <T>(key: string): Promise<T | undefined> => {
  const db = await getDb();
  const entry = await db.get('cache', key);
  return entry?.data as T | undefined;
};

export const cacheSet = async (key: string, data: any): Promise<void> => {
  const db = await getDb();
  await db.put('cache', { key, data, updatedAt: Date.now() });
};

export const cacheClear = async (): Promise<void> => {
  const db = await getDb();
  await db.clear('cache');
};

// Sync queue operations
export const addToSyncQueue = async (op: Omit<SyncOperation, 'id' | 'createdAt'>): Promise<void> => {
  const db = await getDb();
  await db.add('syncQueue', {
    ...op,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
};

export const getSyncQueue = async (): Promise<SyncOperation[]> => {
  const db = await getDb();
  return db.getAllFromIndex('syncQueue', 'by-createdAt');
};

export const removeSyncItem = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.delete('syncQueue', id);
};

export const getSyncQueueCount = async (): Promise<number> => {
  const db = await getDb();
  return db.count('syncQueue');
};
