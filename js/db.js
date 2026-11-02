// Guarda os cards no próprio aparelho (IndexedDB), para nada se perder ao fechar o app.

const DB_NAME = 'app-da-lavinia';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const db = {
  allCards: () =>
    run('cards', 'readonly', (s) => s.getAll()).then((list) =>
      (list || []).sort((a, b) => a.createdAt - b.createdAt)
    ),
  putCard: (card) => run('cards', 'readwrite', (s) => s.put(card)),
  deleteCard: (id) => run('cards', 'readwrite', (s) => s.delete(id)),
  getMeta: (key) => run('meta', 'readonly', (s) => s.get(key)),
  setMeta: (key, value) => run('meta', 'readwrite', (s) => s.put(value, key)),
  deleteMeta: (key) => run('meta', 'readwrite', (s) => s.delete(key)),
};

// Pede ao navegador para não apagar os dados sozinho (Safari costuma limpar sites pouco usados).
export function askPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (_) {
    /* sem suporte: tudo bem */
  }
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
