import { createMultiplayerServer } from './app.js';

const port = Number(process.env.PORT || 3002);
const host = process.env.HOST || '127.0.0.1';
const app = createMultiplayerServer();
app.httpServer.on('error', error => {
  console.error(`Could not start multiplayer server: ${error.message}`);
  process.exitCode = 1;
});
app.httpServer.listen(port, host, () => {
  console.log(`Multiplayer movement test server: http://${host}:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { await app.close(); });
}
