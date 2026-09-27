// Local persistence boundary: replace these methods with an API for shared rooms.
export const MAX_IMAGES = 15;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImage(file) {
  if (!imageTypes.has(file.type)) return `${file.name}: choose a JPG, PNG or WebP image.`;
  if (!file.size) return `${file.name}: this file is empty.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: exceeds the 2 MB limit.`;
  return null;
}

export function isRoomCode(value) { return /^\d{6}$/.test(value); }

export function generateRoomCode(existing = new Set()) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    // Rejection sampling avoids bias across the 900,000 possible codes.
    if (value[0] >= Math.floor(2 ** 32 / 900000) * 900000) continue;
    const code = String(100000 + value[0] % 900000);
    if (!existing.has(code)) return code;
  }
  throw new Error('Could not generate a unique room code. Please try again.');
}

let database;
function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('shared-gallery-preview', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('rooms', { keyPath: 'code' });
      request.result.createObjectStore('drafts');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other gallery tabs and reload to enable saved drafts.'));
  });
  return database;
}

async function transaction(storeName, mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || request.error || new Error('Storage was interrupted.'));
  });
}

export const localRooms = {
  getRoom: code => transaction('rooms', 'readonly', store => store.get(code)),
  getDraft: () => transaction('drafts', 'readonly', store => store.get('artist')),
  saveDraft: draft => transaction('drafts', 'readwrite', store => store.put(draft, 'artist')),
  async createRoom({ username, images }) {
    if (!username.trim() || !images.length || images.length > MAX_IMAGES || images.some(validateImage)) {
      throw new Error('Enter a username and choose 1–15 valid images.');
    }
    const codes = await transaction('rooms', 'readonly', store => store.getAllKeys());
    const room = { code: generateRoomCode(new Set(codes)), username, images, createdAt: Date.now() };
    // add (rather than put) prevents another tab's room from being overwritten.
    await transaction('rooms', 'readwrite', store => store.add(room));
    return room;
  },
};
