/**
 * Minimal promise wrapper around IndexedDB for structured user content
 * (tasks, notes). No dependency; every record read back is validated.
 */

export const DB_NAME = "productivity-hub";
/** v1: tasks, notes · v2: expenses */
export const DB_VERSION = 2;
export const STORES = ["tasks", "notes", "expenses"] as const;
export type StoreName = (typeof STORES)[number];

export class StorageUnavailableError extends Error {
  constructor(message = "IndexedDB is not available") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === "undefined") throw new StorageUnavailableError();
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error instanceof StorageUnavailableError ? error : new StorageUnavailableError(String(error)));
      return;
    }
    // Schema migrations: every version so far only adds stores, so creating
    // the missing ones upgrades any older database without touching its data.
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(new StorageUnavailableError(request.error?.message));
    request.onblocked = () => reject(new StorageUnavailableError("Database upgrade blocked by another tab"));
  });
  dbPromise = promise;
  promise.catch(() => {
    dbPromise = null;
  });
  return promise;
}

/** Test helper: forget the cached connection. */
export function resetDatabaseConnection(): void {
  void dbPromise?.then((db) => db.close()).catch(() => {});
  dbPromise = null;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export interface Repository<T extends { id: string }> {
  /** Returns valid records; `skipped` counts records that failed validation. */
  getAll(): Promise<{ items: T[]; skipped: number }>;
  put(item: T): Promise<void>;
  putMany(items: readonly T[]): Promise<void>;
  remove(id: string): Promise<void>;
  /** Atomically replaces every record in the store. */
  replaceAll(items: readonly T[]): Promise<void>;
}

export function createRepository<T extends { id: string }>(
  store: StoreName,
  parse: (raw: unknown) => T | null,
): Repository<T> {
  async function write(run: (os: IDBObjectStore) => void): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(store, "readwrite");
    run(tx.objectStore(store));
    await transactionDone(tx);
  }

  return {
    async getAll() {
      const db = await openDatabase();
      const raw = await promisify(db.transaction(store, "readonly").objectStore(store).getAll());
      const items: T[] = [];
      let skipped = 0;
      for (const record of raw) {
        const parsed = parse(record);
        if (parsed) items.push(parsed);
        else skipped++;
      }
      return { items, skipped };
    },
    put: (item) => write((os) => os.put(item)),
    putMany: (items) => write((os) => items.forEach((item) => os.put(item))),
    remove: (id) => write((os) => os.delete(id)),
    replaceAll: (items) =>
      write((os) => {
        os.clear();
        items.forEach((item) => os.put(item));
      }),
  };
}

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
