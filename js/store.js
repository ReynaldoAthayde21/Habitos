// Armazenamento local: IndexedDB (estado em JSON + fotos/arquivos como blobs).
// Nada sai do aparelho.

const DB_NAME = 'habitos';
const DB_VERSION = 1;
let dbp = null;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(r => { out = r; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function reqP(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function kvGet(key) {
  const db = await openDB();
  return reqP(db.transaction('kv').objectStore('kv').get(key));
}
export function kvSet(key, val) {
  return tx('kv', 'readwrite', s => { s.put(val, key); });
}

// ---------- blobs (fotos, PDF) ----------
const urlCache = new Map();

export function newId(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function putBlob(blob, prefix = 'ph') {
  const id = newId(prefix);
  await tx('blobs', 'readwrite', s => { s.put(blob, id); });
  return id;
}
export async function getBlob(id) {
  if (!id) return null;
  const db = await openDB();
  return reqP(db.transaction('blobs').objectStore('blobs').get(id));
}
export async function blobURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await getBlob(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}
export async function deleteBlob(id) {
  if (!id) return;
  if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
  await tx('blobs', 'readwrite', s => { s.delete(id); });
}
async function allBlobKeys() {
  const db = await openDB();
  return reqP(db.transaction('blobs').objectStore('blobs').getAllKeys());
}
async function clearBlobs() {
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  await tx('blobs', 'readwrite', s => { s.clear(); });
}

// Reduz a foto (máx. 1400 px) para economizar espaço.
export async function compressImage(file, max = 1400, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', quality));
  } catch (e) {
    return file;
  }
}

// ---------- backup ----------
function blobToDataURL(b) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
}
async function dataURLToBlob(d) {
  const r = await fetch(d);
  return r.blob();
}

export async function exportBackup(state) {
  const keys = await allBlobKeys();
  const blobs = {};
  for (const k of keys) {
    const b = await getBlob(k);
    if (b) blobs[k] = await blobToDataURL(b);
  }
  return JSON.stringify({ app: 'habitos', format: 1, exportedAt: new Date().toISOString(), state, blobs });
}

export async function importBackup(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'habitos' || !data.state) throw new Error('Arquivo não é um backup do Hábitos.');
  await clearBlobs();
  for (const [k, d] of Object.entries(data.blobs || {})) {
    const b = await dataURLToBlob(d);
    await tx('blobs', 'readwrite', s => { s.put(b, k); });
  }
  await kvSet('state', data.state);
  return data.state;
}

export async function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
  return false;
}
export async function storageEstimate() {
  try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) {}
  return null;
}
