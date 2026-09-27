import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';
import { createMultiplayerServer } from '../app.js';

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Missing ${name}`)), 3000);
    socket.once(name, data => { clearTimeout(timeout); resolve(data); });
  });
}
const image = { type: 'image/png', data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGmkAAAAASUVORK5CYII=', 'base64') };
async function setup(t, options) {
  const app = createMultiplayerServer(options);
  await new Promise(resolve => app.httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.httpServer.address().port}`;
  const clients = [];
  t.after(async () => { clients.forEach(c => c.disconnect()); await app.close(); });
  return { app, base, async connect(transports = ['websocket']) {
    const socket = io(`${base}/gallery`, { autoConnect: false, forceNew: true, reconnection: false, transports });
    clients.push(socket);
    const ready = event(socket, 'connect'); socket.connect(); await ready;
    return socket;
  } };
}
async function request(socket, name, data) {
  // Respect the application's request throttle, including rejected requests.
  await delay(160);
  return socket.timeout(3000).emitWithAck(name, data);
}

test('independent gallery clients share artwork, names, movement and cleanup with room isolation', { timeout: 15000 }, async t => {
  const { connect, base } = await setup(t);
  const host = await connect();
  const made = await request(host, 'gallery:create', { username: 'Artist', images: [image] });
  assert(made.ok);
  const room = made.value;
  const guest = await connect(['polling']);
  for (const username of ['Artist', ' artist ', 'ＡＲＴＩＳＴ']) {
    const rejected = await request(guest, 'gallery:join', { username, code: room.code });
    assert.equal(rejected.ok, false);
    assert.match(rejected.error, /belongs to the artist/);
  }
  const joined = event(host, 'gallery:joined');
  const visitor = (await request(guest, 'gallery:join', { username: 'Guest', code: room.code })).value;
  assert.equal((await joined).player.id, visitor.selfId);
  assert.equal(visitor.players.length, 2);
  assert.equal(visitor.code, undefined);
  assert.deepEqual(visitor.players.find(p => p.id === room.selfId), room.players[0]);
  assert.notEqual(visitor.players[0].color, visitor.players[1].color);
  assert.deepEqual(visitor.artworks, room.artworks);
  // Ordinary HTTP requests can retrieve actual bytes without browser storage.
  const artwork = await fetch(base + visitor.artworks[0]);
  assert.equal(artwork.headers.get('content-type'), image.type);
  assert.deepEqual(Buffer.from(await artwork.arrayBuffer()), image.data);
  assert.equal((await request(guest, 'gallery:code', {})).ok, false);
  const moved = event(guest, 'gallery:moved');
  host.emit('gallery:move', { id: visitor.selfId, username: 'Spoof', color: '#000', x: 8, y: 1.5, z: 10, rotationY: 0.8 });
  assert.deepEqual(await moved, { roomId: room.roomId, id: room.selfId, x: 8, y: 1.5, z: 10, rotationY: 0.8 });
  const late = await connect();
  const later = (await request(late, 'gallery:join', { username: 'Late', code: room.code })).value;
  assert.equal(later.players.find(p => p.id === room.selfId).x, 8);
  const other = await connect();
  const isolated = (await request(other, 'gallery:create', { username: 'Artist', images: [image] })).value;
  assert.notEqual(isolated.roomId, room.roomId);
  assert.equal(isolated.players.length, 1);
  const leaks = [];
  other.on('gallery:moved', v => leaks.push(v));
  guest.emit('gallery:move', { x: 0, y: 1.5, z: 16, rotationY: 0 });
  await delay(70);
  assert.equal(leaks.length, 0);
  const left = event(guest, 'gallery:left');
  host.disconnect();
  assert.equal((await left).id, room.selfId);
  // Host name remains reserved even while the host is disconnected.
  const denied = await request(other, 'gallery:join', { username: 'ARTIST', code: room.code });
  assert.equal(denied.ok, false);
  const resumed = await connect();
  const restored = (await request(resumed, 'gallery:resume', { token: room.token })).value;
  assert.equal(restored.selfId, room.selfId);
  assert.equal(restored.role, 'host');
  assert.equal(restored.code, room.code);
  assert.equal(restored.players.find(p => p.id === room.selfId).x, 8);
});

test('reject invalid images, unknown codes, expired sessions and malformed movement', async t => {
  const { connect } = await setup(t, { galleryOptions: { reconnectMs: 20 } });
  const socket = await connect();
  assert.equal((await request(socket, 'gallery:create', { username: 'A', images: [{ type: 'image/png', data: Buffer.from('bad') }] })).ok, false);
  assert.equal((await request(socket, 'gallery:join', { username: 'G', code: '000000' })).ok, false);
  const room = (await request(socket, 'gallery:create', { username: 'A', images: [image] })).value;
  socket.emit('gallery:move', { x: Infinity, y: 1.5, z: 0, rotationY: 0 });
  socket.emit('gallery:move', null);
  const guest = await connect();
  const view = (await request(guest, 'gallery:join', { username: 'B', code: room.code })).value;
  assert.deepEqual(view.players[0], room.players[0]);
  const left = event(guest, 'gallery:left'); socket.disconnect(); await left;
  const reconnect = await connect();
  const expired = await request(reconnect, 'gallery:resume', { token: room.token });
  assert.equal(expired.ok, false);
  assert.match(expired.error, /expired/);
});

test('production serves built website and model alongside the API without exposing server files', async t => {
  const clientDirectory = new URL('../../client/dist/', import.meta.url);
  const { fileURLToPath } = await import('node:url');
  const { base } = await setup(t, { clientDirectory: fileURLToPath(clientDirectory), clientOrigin: 'https://gallery.example' });
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Step inside/);
  const model = await fetch(`${base}/models/gallery.glb`);
  assert.deepEqual(Buffer.from(await model.arrayBuffer()), await readFile(new URL('../../client/public/models/gallery.glb', import.meta.url)));
  for (const path of ['/server.js', '/.env', '/%2e%2e%5cserver%5cserver.js', '/api/missing']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  const health = await fetch(`${base}/api/health`, { headers: { Origin: 'https://gallery.example' } });
  assert.equal(health.headers.get('access-control-allow-origin'), 'https://gallery.example');
});
