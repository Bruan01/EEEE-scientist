/**
 * Minimal IndexedDB helpers (no external deps)
 *
 * Used for caching small (<1MB) file contents locally to avoid repeated loads.
 */
export type IdbValue = unknown

type OpenDbOptions = {
  dbName: string
  version: number
  storeName: string
}

function openDb({ dbName, version, storeName }: OpenDbOptions): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function createIdbStore(options: OpenDbOptions) {
  let dbPromise: Promise<IDBDatabase> | null = null
  const getDb = () => {
    if (!dbPromise) dbPromise = openDb(options)
    return dbPromise
  }

  const withStore = async <T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>
  ): Promise<T> => {
    const db = await getDb()
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(options.storeName, mode)
      const store = tx.objectStore(options.storeName)

      Promise.resolve(fn(store))
        .then((reqOrValue) => {
          if (reqOrValue instanceof IDBRequest) {
            requestToPromise(reqOrValue)
              .then(resolve)
              .catch(reject)
          } else {
            resolve(reqOrValue)
          }
        })
        .catch(reject)

      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  return {
    async get<T = IdbValue>(key: string): Promise<T | undefined> {
      return await withStore('readonly', (store) => store.get(key))
    },
    async set<T = IdbValue>(key: string, value: T): Promise<void> {
      await withStore('readwrite', (store) => store.put(value as unknown as IdbValue, key))
    },
    async del(key: string): Promise<void> {
      await withStore('readwrite', (store) => store.delete(key))
    },
    async keys(): Promise<string[]> {
      const db = await getDb()
      const tx = db.transaction(options.storeName, 'readonly')
      const store = tx.objectStore(options.storeName)

      // getAllKeys is widely supported in modern browsers
      const keys = (await requestToPromise(store.getAllKeys())) as IDBValidKey[]
      return keys.map(String)
    },
  }
}

