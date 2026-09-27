import { io } from 'socket.io-client';

export function createGalleryConnection(runtime, { onStatus, onSession, onExpired,
  serverUrl = import.meta.env?.VITE_GALLERY_SERVER || '' } = {}) {
  const origin = serverUrl.replace(/\/$/, '');
  const socket = io(`${origin}/gallery`, { autoConnect: false });
  // Memory only: a duplicated tab must never inherit the host credential.
  let session = null;
  let token = null;
  let connecting;
  let elapsed = 0;
  let latestMovement = '';
  let restoring = false;
  const request = async (event, data = {}) => {
    const reply = await socket.timeout(30000).emitWithAck(event, data);
    if (!reply.ok) throw new Error(reply.error);
    return reply.value;
  };
  async function ensureConnected() {
    if (restoring) throw new Error('Reconnecting to your room. Please wait.');
    if (socket.connected) return;
    if (!connecting) {
      connecting = new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error('Cannot reach the gallery server. Check your connection and try again.')), 10000);
        function finish(error) {
          clearTimeout(timer);
          socket.off('connect', connected);
          socket.off('connect_error', failed);
          connecting = null;
          error ? reject(error) : resolve();
        }
        function connected() { finish(); }
        function failed() { finish(new Error('Cannot reach the gallery server. Check your connection and try again.')); }
        socket.once('connect', connected);
        socket.once('connect_error', failed);
        socket.connect();
      });
    }
    await connecting;
  }
  function apply(value) {
    if (origin) value.artworks = value.artworks.map(path => new URL(path, origin).href);
    session = value;
    token = value.token;
    runtime.clearRemote();
    const self = value.players.find(player => player.id === value.selfId);
    runtime.setIdentity(self);
    runtime.playerController.setSpawn(self);
    runtime.setOnline(true);
    value.players.filter(player => player.id !== value.selfId).forEach(runtime.addRemote);
    latestMovement = '';
    onStatus('');
    onSession(value);
    return value;
  }
  socket.on('gallery:joined', data => { if (data.roomId === session?.roomId) runtime.addRemote(data.player); });
  socket.on('gallery:moved', data => { if (data.roomId === session?.roomId && data.id !== session.selfId) runtime.moveRemote(data); });
  socket.on('gallery:left', data => { if (data.roomId === session?.roomId) runtime.removeRemote(data.id); });
  socket.on('disconnect', () => {
    runtime.setOnline(false);
    runtime.clearRemote();
    if (session) onStatus('Connection lost. Reconnecting to your gallery…');
  });
  socket.on('connect', async () => {
    if (!token) return;
    restoring = true;
    try { apply(await request('gallery:resume', { token })); }
    catch (error) {
      session = null;
      token = null;
      runtime.clearRemote();
      onExpired(error.message || 'Your room connection expired. Please join again.');
    } finally { restoring = false; }
  });
  runtime.setNetworkUpdate(delta => {
    elapsed += delta;
    if (!session || !socket.connected || restoring || elapsed < 0.05) return;
    elapsed = 0;
    const position = runtime.playerController.getState();
    const serialized = JSON.stringify(position);
    if (serialized === latestMovement) return;
    latestMovement = serialized;
    socket.emit('gallery:move', position);
  });
  window.addEventListener('pagehide', () => { token = null; socket.disconnect(); });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  return {
    async create({ username, images }) {
      await ensureConnected();
      const files = await Promise.all(images.map(async file => ({ type: file.type, data: await file.arrayBuffer() })));
      return apply(await request('gallery:create', { username, images: files }));
    },
    async join({ username, code }) {
      await ensureConnected();
      return apply(await request('gallery:join', { username, code }));
    },
    async roomCode() {
      await ensureConnected();
      return (await request('gallery:code')).code;
    },
  };
}
