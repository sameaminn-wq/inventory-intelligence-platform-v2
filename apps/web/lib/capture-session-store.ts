export type StoredCaptureFrame = {
  id: string;
  viewType?: string;
  capturedAt?: string;
  dataUrl: string;
  mimeType?: string;
  metrics?: unknown;
  overlap?: string;
};

export type StoredCaptureSession = {
  schemaVersion?: string;
  captureSessionId: string;
  startedAt?: string;
  savedAt?: string;
  frames: StoredCaptureFrame[];
};

const DATABASE_NAME = 'inventory-intelligence';
const STORE_NAME = 'capture-sessions';
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('هذا المتصفح لا يدعم التخزين المحلي الآمن لجلسات التصوير.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'captureSessionId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('تعذر فتح مخزن جلسات التصوير.'));
  });
}

export async function saveCaptureSession(session: StoredCaptureSession): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(session);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('تعذر حفظ جلسة التصوير.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('تم إلغاء حفظ جلسة التصوير.'));
  }).finally(() => database.close());
}

export async function loadLatestCaptureSession(): Promise<StoredCaptureSession | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const sessions = request.result as StoredCaptureSession[];
      sessions.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
      resolve(sessions[0] ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error('تعذر استعادة جلسة التصوير.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('تعذر قراءة جلسة التصوير.'));
    };
  });
}
