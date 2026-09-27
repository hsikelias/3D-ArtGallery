import { randomInt, randomUUID } from 'node:crypto';

const colors = ['#bba1ec', '#81c9ea', '#e7a1b8', '#8bd3af', '#efcc80', '#eca17e'];
const normalize = name => name.normalize('NFKC').trim().toLowerCase();
export function validGalleryMovement(value) {
  return value && ['x', 'y', 'z', 'rotationY'].every(key => Number.isFinite(value[key]))
    && Math.abs(value.x) <= 100 && Math.abs(value.z) <= 100
    && value.y >= 0 && value.y <= 20 && Math.abs(value.rotationY) <= Math.PI;
}
function checkName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24 || /[\x00-\x1f]/.test(value)) {
    throw new Error('Enter a username with 1–24 characters.');
  }
  return value.trim();
}
function checkImages(images) {
  if (!Array.isArray(images) || images.length < 1 || images.length > 15) throw new Error('Choose 1–15 images.');
  return images.map(image => {
    const data = image?.data;
    if (!Buffer.isBuffer(data) || !data.length || data.length > 2 * 1024 * 1024) throw new Error('Each image must be at most 2 MB.');
    const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    const webp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    const type = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : null;
    if (!type || type !== image.type) throw new Error('Upload a valid JPG, PNG or WebP image.');
    return { data, type };
  });
}

export function attachGalleryRooms(io, { idleMs = 30 * 60 * 1000, reconnectMs = 60000 } = {}) {
  const namespace = io.of('/gallery');
  const rooms = new Map();
  const sessions = new Map();
  const publicPlayer = member => ({ id: member.id, username: member.username, color: member.color, ...member.position });
  function membership(socket) { return sessions.get(socket.data.token); }
  function requireMembership(socket) {
    const session = membership(socket);
    if (!session || session.socketId !== socket.id) throw new Error('Join a room first.');
    return session;
  }
  function snapshot(member) {
    const room = rooms.get(member.roomId);
    return {
      roomId: room.id, selfId: member.id, role: member.host ? 'host' : 'visitor', token: member.token,
      ...(member.host ? { code: room.code } : {}),
      artworks: room.images.map((_, i) => `/api/artworks/${room.id}/${i}`),
      players: [...room.members.values()].filter(m => m.socketId).map(publicPlayer),
    };
  }
  function detach(socket, permanent = false) {
    const member = membership(socket);
    if (!member || member.socketId !== socket.id) return;
    const room = rooms.get(member.roomId);
    socket.leave(member.roomId);
    member.socketId = null;
    member.disconnectedAt = Date.now();
    namespace.to(member.roomId).emit('gallery:left', { roomId: member.roomId, id: member.id });
    if (permanent) { room.members.delete(member.id); sessions.delete(member.token); }
    if (![...room.members.values()].some(m => m.socketId)) room.emptySince = Date.now();
    delete socket.data.token;
  }
  function enter(socket, room, username, host) {
    if ([...room.members.values()].filter(m => m.socketId).length >= 24) throw new Error('This gallery is full.');
    const name = normalize(username);
    if ((!host && name === room.hostName) || [...room.members.values()].some(m => normalize(m.username) === name)) {
      throw new Error('That username is already in use in this room. Choose another name.');
    }
    detach(socket, true);
    const slot = room.members.size;
    const member = {
      id: randomUUID(), token: randomUUID(), roomId: room.id, socketId: socket.id, username, host,
      color: colors[slot % colors.length],
      // Spawn in the entrance area, slightly separated so arrivals are visible.
      position: { x: (slot % 3 - 1) * 3, y: 1.5088105201721191, z: 13.69998455 + Math.floor(slot / 3) * 2, rotationY: 0 },
    };
    room.members.set(member.id, member);
    sessions.set(member.token, member);
    room.emptySince = null;
    socket.data.token = member.token;
    socket.join(room.id);
    socket.to(room.id).emit('gallery:joined', { roomId: room.id, player: publicPlayer(member) });
    return snapshot(member);
  }
  namespace.on('connection', socket => {
    let lastRequest = 0;
    let lastMove = -Infinity;
    function request(event, handler) {
      socket.on(event, (data, ack) => {
        if (typeof ack !== 'function') return;
        try {
          const now = Date.now();
          if (now - lastRequest < 150) throw new Error('Please wait a moment before trying again.');
          lastRequest = now;
          ack({ ok: true, value: handler(data || {}) });
        } catch (error) { ack({ ok: false, error: error.message }); }
      });
    }
    request('gallery:create', data => {
      const username = checkName(data.username);
      if (rooms.size >= 20) throw new Error('The demo server is full. Please try again later.');
      const images = checkImages(data.images);
      let code;
      do { code = String(randomInt(100000, 1000000)); } while ([...rooms.values()].some(r => r.code === code));
      const room = { id: randomUUID(), code, images, hostName: normalize(username), members: new Map(), emptySince: Date.now() };
      rooms.set(room.id, room);
      return enter(socket, room, username, true);
    });
    request('gallery:join', data => {
      const username = checkName(data.username);
      if (typeof data.code !== 'string' || !/^\d{6}$/.test(data.code)) throw new Error('Enter a six-digit room code.');
      const room = [...rooms.values()].find(r => r.code === data.code);
      if (!room) throw new Error('Room not found. Ask the host for the current code. Old local-preview codes do not work online.');
      return enter(socket, room, username, false);
    });
    request('gallery:resume', data => {
      const member = sessions.get(data.token);
      if (!member || member.socketId || Date.now() - member.disconnectedAt > reconnectMs) throw new Error('Your connection expired. Please join or create a room again.');
      member.socketId = socket.id;
      socket.data.token = member.token;
      const room = rooms.get(member.roomId);
      room.emptySince = null;
      socket.join(room.id);
      socket.to(room.id).emit('gallery:joined', { roomId: room.id, player: publicPlayer(member) });
      return snapshot(member);
    });
    request('gallery:code', () => {
      const member = requireMembership(socket);
      if (!member.host) throw new Error('Only the host can view the room code.');
      return { code: rooms.get(member.roomId).code };
    });
    request('gallery:leave', () => { detach(socket, true); return {}; });
    socket.on('gallery:move', value => {
      const member = membership(socket);
      if (!member || member.socketId !== socket.id || !validGalleryMovement(value)) return;
      const now = performance.now();
      if (now - lastMove < 30) return;
      lastMove = now;
      const { x, y, z, rotationY } = value;
      member.position = { x, y, z, rotationY };
      socket.to(member.roomId).emit('gallery:moved', { roomId: member.roomId, id: member.id, ...member.position });
    });
    socket.on('disconnect', () => detach(socket));
  });
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [token, member] of sessions) {
      if (!member.socketId && now - member.disconnectedAt > reconnectMs) {
        sessions.delete(token);
        rooms.get(member.roomId)?.members.delete(member.id);
      }
    }
    for (const [id, room] of rooms) {
      if (room.emptySince && now - room.emptySince > idleMs) {
        room.members.forEach(m => sessions.delete(m.token));
        rooms.delete(id);
      }
    }
  }, 10000);
  cleanup.unref();
  return {
    dispose() { clearInterval(cleanup); rooms.clear(); sessions.clear(); },
    serveArtwork(request, response) {
      const match = /^\/api\/artworks\/([\w-]+)\/(\d+)$/.exec(request.url);
      if (!match || request.method !== 'GET') return false;
      const image = rooms.get(match[1])?.images[Number(match[2])];
      if (!image) { response.writeHead(404); response.end('Artwork expired'); return true; }
      response.writeHead(200, { 'Content-Type': image.type, 'Content-Length': image.data.length,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      response.end(image.data);
      return true;
    },
  };
}
