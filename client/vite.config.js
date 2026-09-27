import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const proxy = {
  '/socket.io': { target: 'http://127.0.0.1:3002', ws: true },
  '/api': { target: 'http://127.0.0.1:3002' },
};

export default defineConfig({
  server: { proxy },
  preview: { proxy },
  build: {
    rollupOptions: {
      input: {
        gallery: fileURLToPath(new URL('./index.html', import.meta.url)),
        multiplayerTest: fileURLToPath(new URL('./multiplayer-test.html', import.meta.url)),
      },
    },
  },
});
