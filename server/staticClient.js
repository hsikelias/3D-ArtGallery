import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

// Serve only the compiled client directory, alongside /socket.io and /api.
export function createStaticClient(directory) {
  const root = resolve(directory);
  return async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      const path = relative(root, file);
      if (isAbsolute(path) || path.split(/[\\/]/).some(part => part.startsWith('.')) || !types[extname(file)]) {
        response.writeHead(404); response.end('Not found'); return;
      }
      const contents = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)], 'Content-Length': contents.length,
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : contents);
    } catch {
      response.writeHead(404); response.end('Not found. Build the client before starting the production server.');
    }
  };
}
