import { createMultiplayerServer } from './app.js';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 3002);
const host = process.env.HOST || '0.0.0.0';
const app = createMultiplayerServer({
  clientDirectory: fileURLToPath(new URL('../client/dist/', import.meta.url)),
  clientOrigin: process.env.CLIENT_ORIGIN,
});
app.httpServer.on('error', error => {
  console.error(`Could not start multiplayer server: ${error.message}`);
  process.exitCode = 1;
});
app.httpServer.listen(port, host, () => {
  console.log(`Gallery multiplayer server: http://${host}:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { await app.close(); });
}
