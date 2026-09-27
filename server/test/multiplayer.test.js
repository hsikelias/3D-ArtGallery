import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createMultiplayerServer, validMovement } from '../app.js';

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timed out waiting for ${name}`)); }, 2500);
    function receive(data) { clearTimeout(timeout); resolve(data); }
    socket.once(name, receive);
  });
}

test('reject nonfinite, missing, and out-of-bounds movement', () => {
  const valid = { x: 0, y: 0.5, z: 0, rotationY: 0 };
  assert.equal(validMovement(valid), true);
  for (const value of [null, [], {}, { ...valid, x: 16 }, { ...valid, z: -16 },
    { ...valid, y: 2 }, { ...valid, x: Infinity }, { ...valid, rotationY: NaN },
    { ...valid, rotationY: 4 }, { ...valid, x: '1' }]) {
    assert.equal(validMovement(value), false);
  }
});

test('real clients synchronize, late join, disconnect, and reconnect independently', { timeout: 10000 }, async t => {
  const app = createMultiplayerServer();
  await new Promise(resolve => app.httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.httpServer.address().port}`;
  const clients = [];
  t.after(async () => { clients.forEach(socket => socket.disconnect()); await app.close(); });
  assert.equal((await (await fetch(`${base}/api/health`)).json()).ok, true);
  assert.equal((await fetch(`${base}/unknown`)).status, 404);
  async function join(transports) {
    const socket = connect(`${base}/movement-test`, { autoConnect: false, forceNew: true, reconnection: false, transports });
    clients.push(socket);
    const received = event(socket, 'session:snapshot');
    socket.connect();
    return { socket, snapshot: await received };
  }
  const a = await join(['websocket']);
  assert.equal(a.snapshot.players.length, 1);
  const joined = event(a.socket, 'player:joined');
  const b = await join(['polling']);
  assert.equal((await joined).id, b.snapshot.selfId);
  assert.notEqual(a.snapshot.selfId, b.snapshot.selfId);
  assert.equal(b.snapshot.players.length, 2);
  assert.notEqual(b.snapshot.players[0].color, b.snapshot.players[1].color);

  const moved = event(b.socket, 'player:moved');
  // Spoofed ID, name and color must not override server identity.
  a.socket.emit('player:move', { id: b.snapshot.selfId, color: '#000000', username: 'fake', x: 2, y: 0.5, z: 3, rotationY: 1 });
  assert.deepEqual(await moved, { id: a.snapshot.selfId, x: 2, y: 0.5, z: 3, rotationY: 1 });
  // Invalid messages cannot change state, even if they arrive after the rate window.
  a.socket.emit('player:move', { x: 900, y: 0.5, z: 3, rotationY: 1 });
  a.socket.emit('player:move', null);
  const c = await join(['websocket']);
  const existing = c.snapshot.players.find(player => player.id === a.snapshot.selfId);
  assert.equal(existing.x, 2);
  assert.notEqual(existing.color, '#000000');

  const left = event(a.socket, 'player:left');
  const oldId = b.snapshot.selfId;
  b.socket.disconnect();
  assert.equal((await left).id, oldId);
  const reconnected = event(b.socket, 'session:snapshot');
  b.socket.connect();
  const snapshot = await reconnected;
  assert.notEqual(snapshot.selfId, oldId);
  assert.equal(snapshot.players.length, 3);
  assert.equal(snapshot.players.some(player => player.id === oldId), false);
  const resumedMove = event(a.socket, 'player:moved');
  b.socket.emit('player:move', { x: -2, y: 0.5, z: 1, rotationY: -1 });
  assert.equal((await resumedMove).id, snapshot.selfId);
});
