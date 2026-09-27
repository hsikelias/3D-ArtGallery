import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { MAX_IMAGE_BYTES, validateImage, generateRoomCode, isRoomCode } from '../src/rooms/localRooms.js';

test('upload boundaries and room codes', () => {
  assert.equal(validateImage({ name: 'art.png', type: 'image/png', size: MAX_IMAGE_BYTES }), null);
  assert.match(validateImage({ name: 'art.png', type: 'image/png', size: MAX_IMAGE_BYTES + 1 }), /2 MB/);
  assert.match(validateImage({ name: 'empty.png', type: 'image/png', size: 0 }), /empty/);
  assert.match(validateImage({ name: 'script.svg', type: 'image/svg+xml', size: 10 }), /JPG/);
  assert.equal(isRoomCode('123456'), true);
  for (const code of ['12345', '1234567', '12A456', ' 123456']) assert.equal(isRoomCode(code), false);
  const used = new Set();
  for (let i = 0; i < 1000; i++) {
    const code = generateRoomCode(used);
    assert.equal(isRoomCode(code), true);
    assert.equal(used.has(code), false);
    used.add(code);
  }
});

// Exercise the actual UI handlers with a DOM adapter and a network boundary.
// Real WebGL placement/collision is covered separately by the gallery tests.
class Element {
  constructor() { this.listeners = {}; this.value = ''; this.children = []; this.hidden = false; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  async fire(name) { await this.listeners[name]?.({ preventDefault() {} }); }
  setAttribute() {}
  focus() {}
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  querySelectorAll() { return []; }
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.close?.(); }
}

test('forms use online rooms and shared URLs; errors preserve membership and visitors cannot show host codes', async () => {
  const elements = new Map();
  const get = key => {
    if (!elements.has(key)) elements.set(key, new Element());
    return elements.get(key);
  };
  const nameTag = { isCSS2DObject: true, element: new Element() };
  let resets = 0;
  let displayed = 0;
  const runtime = {
    controls: {}, ghost: { userData: {}, traverse(fn) { fn(nameTag); } },
    playerController: { reset() { resets++; } },
    artworkManager: { async setImages(urls) { displayed = urls.length; return { errors: [] }; } },
  };
  const rooms = new Map();
  const images = [new File(['image bytes'], 'art.png', { type: 'image/png' })];
  let savedDraft;
  const context = vm.createContext({
    document: { querySelector: get, querySelectorAll: () => [], createElement: () => new Element() },
    window: { addEventListener() {} }, navigator: { clipboard: { async writeText() {} } },
    URL, Blob, console, MAX_IMAGES: 15, validateImage, isRoomCode,
    createGalleryRuntime: async () => runtime,
    createGalleryConnection(_runtime, callbacks) {
      const enter = (room, name) => {
        nameTag.element.textContent = name;
        resets++;
        callbacks.onSession(room);
        return room;
      };
      return {
        async create({ username, images }) {
          const room = { role: 'host', code: '123456', artworks: ['/api/artworks/room/0'] };
          assert.equal(images.length, 1);
          rooms.set(room.code, room);
          return enter(room, username);
        },
        async join({ username, code }) {
          if (!rooms.has(code)) throw new Error('Room not found.');
          if (username.toLowerCase() === 'artist') throw new Error('That name belongs to the artist.');
          return enter({ role: 'visitor', artworks: rooms.get(code).artworks }, username);
        },
      };
    },
    localRooms: {
      async getDraft() { return { images, username: 'Artist' }; },
      async saveDraft(draft) { savedDraft = draft; },
      async createRoom() { assert.fail('Online creation must not use IndexedDB rooms'); },
      async getRoom() { assert.fail('Online joining must not use IndexedDB rooms'); },
    },
  });
  const source = (await readFile(new URL('../src/galleryEntry.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source + '\nglobalThis.ready = Promise.all([sceneReady, restoreDraft]);', context);
  await context.ready;
  const dialog = get('#entry-dialog');
  await dialog.fire('cancel');
  assert.equal(dialog.open, true, 'first-time users cannot dismiss entry');
  await get('#choose-create').fire('click');
  get('#image-files').files = Array(15).fill(images[0]);
  await get('#image-files').fire('change');
  assert.match(get('#art-error').textContent, /15 images/);
  get('#image-files').files = [new File(['not an image'], 'bad.svg', { type: 'image/svg+xml' })];
  await get('#image-files').fire('change');
  assert.match(get('#art-error').textContent, /JPG/);
  await get('#art-form').fire('submit');
  assert.equal(get('#submit-entry').textContent, 'Create room');
  await get('#identity-form').fire('submit');
  assert.equal(displayed, 1);
  assert.equal(nameTag.element.textContent, 'Artist');
  assert.equal(savedDraft.images.length, 1);
  assert.equal(dialog.open, false);
  assert.equal(resets, 1);
  await get('#show-room-code').fire('click');
  assert.equal(get('#room-code-display').textContent, '123456');
  await get('#close-menu').fire('click');
  await get('#show-room-code').fire('click');
  assert.equal(get('#room-code-display').textContent, '123456', 'showing a code never regenerates it');
  await get('#close-menu').fire('click');
  await get('#reopen').fire('click');
  await get('#choose-join').fire('click');
  get('#room-code').value = '999999';
  await get('#room-form').fire('submit');
  await get('#identity-form').fire('submit');
  assert.match(get('#entry-error').textContent, /not found/);
  assert.equal(dialog.open, true);
  assert.equal(displayed, 1, 'failed join preserves the previous exhibition');
  get('#room-code').value = '123456';
  await get('#identity-form').fire('submit');
  assert.match(get('#entry-error').textContent, /belongs to the artist/);
  get('#username').value = 'Visitor';
  await get('#identity-form').fire('submit');
  assert.equal(nameTag.element.textContent, 'Visitor');
  assert.equal(dialog.open, false);
  assert.equal(get('#show-room-code').hidden, true);
});
