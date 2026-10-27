// Mock harness only: serves this folder, and /aisf/… from packages/app/assets/kit like the app.
// node serve.mjs [port]  →  http://localhost:5310/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const kit = fileURLToPath(new URL('../../../packages/app/assets/kit/', import.meta.url));
const port = Number(process.argv[2] ?? 5310);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/_status')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'open', version: 1 }));
    return;
  }
  const base = path.startsWith('/aisf/') ? kit : root;
  const rest = path.startsWith('/aisf/') ? path.slice('/aisf/'.length) : path;
  const file = normalize(join(base, rest === '/' ? 'index.html' : rest));
  if (!file.startsWith(base)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
