import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { attachGalleryRooms } from './galleryRooms.js';
import { createStaticClient } from './staticClient.js';

export function validMovement(value) {
  return value !== null && typeof value === 'object'
    && ['x', 'y', 'z', 'rotationY'].every(key => Number.isFinite(value[key]))
    && Math.abs(value.x) <= 15 && Math.abs(value.z) <= 15
    && value.y === 0.5 && Math.abs(value.rotationY) <= Math.PI;
}

// PLAN.md Stages 10–14: online galleries plus the separate cube diagnostic.
export function createMultiplayerServer({ clientDirectory, clientOrigin, galleryOptions } = {}) {
  const serveClient = clientDirectory ? createStaticClient(clientDirectory) : null;
  let galleries;
  const httpServer = createServer((request, response) => {
    if (clientOrigin && request.headers.origin === clientOrigin) {
      response.setHeader('Access-Control-Allow-Origin', clientOrigin);
      response.setHeader('Vary', 'Origin');
    }
    if (galleries?.serveArtwork(request, response)) return;
    if (request.method === 'GET' && request.url === '/api/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: true, stage: 'gallery-multiplayer' }));
      return;
    }
    if (serveClient && !request.url.startsWith('/api/')) { void serveClient(request, response); return; }
    response.writeHead(404);
    response.end('Not found');
  });
  const io = new Server(httpServer, { maxHttpBufferSize: 32 * 1024 * 1024, serveClient: false,
    ...(clientOrigin ? { cors: { origin: clientOrigin } } : {}) });
  galleries = attachGalleryRooms(io, galleryOptions);
  const session = io.of('/movement-test');
  const players = new Map();
  const slots = new Map();
  const colors = ['#bba1ec', '#81c9ea', '#e7a1b8', '#8bd3af', '#efcc80', '#eca17e'];

  session.use((socket, next) => {
    next(players.size >= 24 ? new Error('The movement test is full (24 players).') : undefined);
  });
  session.on('connection', socket => {
    let slot = 0;
    while (slots.has(slot)) slot++;
    slots.set(slot, socket.id);
    const player = {
      id: socket.id,
      color: colors[slot % colors.length],
      x: (slot % 6) * 2 - 5,
      y: 0.5,
      z: Math.floor(slot / 6) * 2,
      rotationY: 0,
    };
    players.set(socket.id, player);
    socket.emit('session:snapshot', { selfId: socket.id, players: [...players.values()] });
    socket.broadcast.emit('player:joined', player);
    let lastMove = -Infinity;
    socket.on('player:move', value => {
      if (!validMovement(value)) return;
      const now = performance.now();
      if (now - lastMove < 30) return;
      lastMove = now;
      // Identity is derived from the socket, never trusted from the packet.
      const { x, y, z, rotationY } = value;
      Object.assign(player, { x, y, z, rotationY });
      socket.broadcast.emit('player:moved', { id: socket.id, x, y, z, rotationY });
    });
    socket.on('disconnect', () => {
      players.delete(socket.id);
      slots.delete(slot);
      session.emit('player:left', { id: socket.id });
    });
  });
  return {
    httpServer,
    io,
    close: () => new Promise(resolve => { galleries.dispose(); io.close(resolve); }),
  };
}
