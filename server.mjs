import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWeatherMiddleware } from './service/vite-plugin.mjs';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const api = createWeatherMiddleware();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function staticFile(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (filename !== resolve(root, 'index.html') && !filename.startsWith(`${resolve(root)}${sep}`)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(filename);
    res.writeHead(200, { 'content-type': mime[extname(filename)] || 'application/octet-stream', 'cache-control': filename.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end('Not found'); }
}

const port = Number(process.env.PORT || 3000);
createServer((req, res) => api(req, res, () => staticFile(req, res))).listen(port, '0.0.0.0', () => {
  console.log(`AgentVault listening on ${port}`);
});
