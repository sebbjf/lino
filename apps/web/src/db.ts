import { setBlobStore } from './images.ts'

// One IndexedDB database: `boards` holds a record per board, `images` the blobs of images (version 2, ADR 0002).
let dbPromise: Promise<IDBDatabase> | undefined
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('lino', 2)
    req.onupgradeneeded = () => {
      for (const name of ['boards', 'images']) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = undefined // let the next call try again
      reject(req.error)
    }
  })
  return dbPromise
}

export async function run<T>(store: 'boards' | 'images', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const tx = (await db()).transaction(store, mode)
  return new Promise((resolve, reject) => {
    const req = fn(tx.objectStore(store))
    // a write only counts once the transaction commits: a full disk aborts it after the request succeeded
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = tx.onabort = () => reject(tx.error ?? req.error)
  })
}

setBlobStore({
  get: (id) => run<Blob | undefined>('images', 'readonly', (s) => s.get(id)),
  put: async (id, blob) => void (await run('images', 'readwrite', (s) => s.put(blob, id))),
  ids: async () => (await run('images', 'readonly', (s) => s.getAllKeys())) as string[],
  delete: async (id) => void (await run('images', 'readwrite', (s) => s.delete(id))),
})
