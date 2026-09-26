// PROTOTYPE — throwaway. Stands in for the aisf app's board page route and bridge.
// Run: node prototype/design-canvas/serve.mjs [design-dir]   → http://127.0.0.1:4390/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const designDir = path.resolve(process.argv[2] ?? path.join(here, 'designs/postkarte-trip-library'));
const outbox = path.join(here, 'outbox.jsonl'); // PROTOTYPE, wipe me: what the bridge would push into the session
const port = 4390;
const types = { '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
const clients = new Set();

function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(buf);
  });
}

let timer;
function changed(dir) {
  return (_, name) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const c of clients) c.write(`event: reload\ndata: ${JSON.stringify({ file: path.join(path.relative(designDir, dir), name ?? '') })}\n\n`);
    }, 150);
  };
}
fs.watch(designDir, changed(designDir));
if (fs.existsSync(path.join(designDir, 'boards'))) fs.watch(path.join(designDir, 'boards'), changed(path.join(designDir, 'boards')));

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/') return serveFile(res, path.join(here, 'board.html'));
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': hi\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/send' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      const msg = { uuid: crypto.randomUUID(), at: new Date().toISOString(), ...JSON.parse(body) };
      fs.appendFileSync(outbox, JSON.stringify(msg) + '\n');
      console.log(`\n→ session  [${msg.tag}]\n${JSON.stringify(msg, null, 2)}`);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(msg));
    });
    return;
  }
  if (url.pathname === '/outbox') {
    const lines = fs.existsSync(outbox) ? fs.readFileSync(outbox, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(lines));
  }
  if (url.pathname.startsWith('/design/')) {
    const file = path.normalize(path.join(designDir, decodeURIComponent(url.pathname.slice('/design/'.length))));
    if (!file.startsWith(designDir)) return res.writeHead(403).end();
    return serveFile(res, file);
  }
  res.writeHead(404).end('not found');
}).listen(port, '127.0.0.1', () => console.log(`board page: http://127.0.0.1:${port}/   design: ${designDir}`));
