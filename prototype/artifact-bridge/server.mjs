// Throwaway prototype for "Prototype the artifact-to-session bridge" (#8).
// One local server, one long-lived Agent SDK session in streaming input mode,
// locally served HTML artifacts whose clicks become user messages in that session.
//
//   node server.mjs [project-dir]      (default: ./demo-project)
//   open http://127.0.0.1:4317/        (session console)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const PORT = Number(process.env.PORT ?? 4317);
const HOST = '127.0.0.1';
const ORIGIN = `http://${HOST}:${PORT}`;
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PROJECT = path.resolve(process.argv[2] ?? path.join(HERE, 'demo-project'));
const FIRST_PROMPT = process.env.FIRST_PROMPT ?? '/demo-questionnaire';
// App-owned store, outside the repo: artifacts are disposable decision devices.
const STORE = path.join(process.env.AISF_HOME ?? path.join(os.homedir(), '.aisf'), 'artifacts');

// ---------------------------------------------------------------- session input queue
// The prompt is an async iterable we never end, so the session stays alive between turns.
const pending = [];
let wake = null;
function push(msg) { pending.push(msg); wake?.(); wake = null; }
async function* input() {
  for (;;) {
    while (pending.length) yield pending.shift();
    await new Promise(r => (wake = r));
  }
}
function userMessage(text, extra = {}) {
  return {
    type: 'user', uuid: crypto.randomUUID(), parent_tool_use_id: null,
    message: { role: 'user', content: text }, ...extra,
  };
}

// ---------------------------------------------------------------- artifacts
// id -> { id, title, version, token, dir, sse:Set<res>, events: [] }
const artifacts = new Map();
let sessionId = null;

function artifactUrl(a) { return `${ORIGIN}/a/${a.id}/?t=${a.token}`; }

function broadcast(set, event, data) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(line);
}

// The one tool a skill needs instead of claude.ai's Artifact publish + watch.
const aisf = createSdkMcpServer({
  name: 'aisf',
  version: '0.0.1',
  instructions:
    'Show HTML pages to the human with aisf_show_artifact. Their clicks arrive later as user ' +
    'messages starting with "[aisf artifact event]". Reuse the same id to update a page in place.',
  tools: [
    tool(
      'aisf_show_artifact',
      'Publish (or republish) a local HTML page for the human. Write the page to a file first, ' +
        'then pass its path. The page may call window.aisf.send(type, data) to send you a message, ' +
        'and window.aisf.state.save(obj) / .load() to persist answers across reloads. Same id = ' +
        'update in place; open tabs reload themselves.',
      {
        id: z.string().regex(/^[a-z0-9-]{1,40}$/).describe('Stable slug, e.g. "plan-42"'),
        title: z.string().max(80),
        file_path: z.string().describe('Absolute path of the HTML file you wrote'),
        assets: z.array(z.string()).optional().describe('Extra files served next to the page'),
      },
      async ({ id, title, file_path, assets = [] }) => {
        let a = artifacts.get(id);
        if (!a) {
          a = { id, title, version: 0, token: crypto.randomBytes(12).toString('base64url'),
                dir: path.join(STORE, sessionId ?? 'nosession', id), sse: new Set(), events: [] };
          artifacts.set(id, a);
        }
        fs.mkdirSync(a.dir, { recursive: true });
        fs.copyFileSync(file_path, path.join(a.dir, 'index.html'));
        for (const f of assets) fs.copyFileSync(f, path.join(a.dir, path.basename(f)));
        a.version += 1;
        a.title = title;
        broadcast(a.sse, 'reload', { version: a.version });
        broadcast(consoleClients, 'artifact', { id, title, version: a.version, url: artifactUrl(a) });
        return { content: [{ type: 'text', text:
          `Published "${title}" v${a.version} at ${artifactUrl(a)} . The human sees it in the ` +
          `AISF inbox. End your turn now; their input arrives as a new user message.` }] };
      },
      // Without this the tool is deferred and the agent burns a ToolSearch call first.
      { alwaysLoad: true },
    ),
  ],
});

// ---------------------------------------------------------------- the session
const consoleClients = new Set();
const log = [];
function emit(kind, data) {
  const entry = { at: new Date().toISOString(), kind, ...data };
  log.push(entry);
  broadcast(consoleClients, 'log', entry);
}

// uuid of an injected event -> artifact id, so we can ack "consumed" back to the page
const inFlight = new Map();

async function runSession() {
  const q = query({
    prompt: input(),
    options: {
      cwd: PROJECT,
      model: process.env.MODEL ?? 'haiku',
      mcpServers: { aisf },
      permissionMode: 'dontAsk',
      allowedTools: ['Write', 'Read', 'mcp__aisf__aisf_show_artifact'],
      settingSources: ['project'],
    },
  });
  push(userMessage(FIRST_PROMPT));
  emit('user', { text: FIRST_PROMPT });

  for await (const m of q) {
    if (m.type === 'system' && m.subtype === 'init') {
      sessionId = m.session_id;
      emit('system', { text: `session ${m.session_id} · skills: ${(m.skills ?? []).join(', ')}` });
    } else if (m.type === 'assistant') {
      for (const b of m.message.content) {
        if (b.type === 'text') emit('assistant', { text: b.text });
        if (b.type === 'tool_use') emit('tool', { text: `${b.name} ${JSON.stringify(b.input).slice(0, 200)}` });
      }
    } else if (m.type === 'user' && m.isReplay) {
      // The CLI echoes our injected message when it takes it into the conversation.
      const aid = inFlight.get(m.uuid);
      if (aid) {
        inFlight.delete(m.uuid);
        broadcast(artifacts.get(aid).sse, 'ack', { uuid: m.uuid, status: 'consumed' });
      }
    } else if (m.type === 'result') {
      for (const u of m.user_message_uuids ?? []) {
        const aid = inFlight.get(u);
        if (aid) { inFlight.delete(u); broadcast(artifacts.get(aid).sse, 'ack', { uuid: u, status: 'consumed' }); }
      }
      emit('result', { text: `turn done · ${m.subtype} · turns=${m.num_turns} · msgs=${(m.user_message_uuids ?? []).length}` });
    }
  }
  emit('system', { text: 'session ended' });
}

// ---------------------------------------------------------------- HTTP
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readJson(req) {
  return new Promise((ok, bad) => {
    let s = ''; req.on('data', c => (s += c)); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { bad(e); } });
  });
}
function sse(res, set) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  res.write(': hi\n\n');
  set.add(res);
  res.on('close', () => set.delete(res));
}
// Guard: only our own pages may post into the session (any website could hit localhost).
function authorised(req, url, a) {
  const token = req.headers['x-aisf-token'] ?? url.searchParams.get('t');
  const origin = req.headers.origin;
  return a && token === a.token && (!origin || origin === ORIGIN);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const p = url.pathname;

  if (p === '/') return send(res, 200, fs.readFileSync(path.join(HERE, 'console.html')), 'text/html');
  if (p === '/aisf/bridge.js') return send(res, 200, fs.readFileSync(path.join(HERE, 'bridge.js')), 'text/javascript');
  if (p === '/api/console') {
    sse(res, consoleClients);
    for (const e of log) res.write(`event: log\ndata: ${JSON.stringify(e)}\n\n`);
    for (const a of artifacts.values())
      res.write(`event: artifact\ndata: ${JSON.stringify({ id: a.id, title: a.title, version: a.version, url: artifactUrl(a) })}\n\n`);
    return;
  }
  if (p === '/api/say' && req.method === 'POST') { // chat box on the console
    const { text } = await readJson(req);
    push(userMessage(text)); emit('user', { text });
    return send(res, 202, { ok: true });
  }

  // /a/<id>/            -> page, with the bridge injected
  // /a/<id>/<file>      -> asset
  // /a/<id>/_events     POST  -> becomes a user message in the session
  // /a/<id>/_state      GET/PUT -> persisted answers (replaces artifact.publish(html))
  // /a/<id>/_stream     SSE   -> reload + delivery acks
  const m = p.match(/^\/a\/([a-z0-9-]+)\/(.*)$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const a = artifacts.get(m[1]);
  const rest = m[2];
  if (!a) return send(res, 404, { error: 'no such artifact' });

  if (rest === '' ) {
    if (url.searchParams.get('t') !== a.token) return send(res, 403, 'bad token', 'text/plain');
    const html = fs.readFileSync(path.join(a.dir, 'index.html'), 'utf8');
    const boot = `<script>window.__AISF__=${JSON.stringify({ id: a.id, token: a.token, version: a.version })}</script>` +
                 `<script src="/aisf/bridge.js"></script>`;
    const out = html.includes('</head>') ? html.replace('</head>', boot + '</head>') : boot + html;
    return send(res, 200, out, 'text/html; charset=utf-8');
  }
  if (!authorised(req, url, a)) return send(res, 403, { error: 'forbidden' });

  if (rest === '_stream') return sse(res, a.sse);
  if (rest === '_state') {
    const f = path.join(a.dir, 'state.json');
    if (req.method === 'PUT') { fs.writeFileSync(f, JSON.stringify(await readJson(req), null, 2)); return send(res, 200, { ok: true }); }
    return send(res, 200, fs.existsSync(f) ? fs.readFileSync(f) : '{}');
  }
  if (rest === '_events' && req.method === 'POST') {
    const ev = await readJson(req);
    const msg = userMessage(
      `[aisf artifact event] artifact=${a.id} v${a.version} type=${ev.type}\n` +
      '```json\n' + JSON.stringify(ev.data ?? null, null, 2) + '\n```',
      // Mid-turn clicks join the running turn at the next tool boundary; idle -> starts a turn.
    );
    inFlight.set(msg.uuid, a.id);
    a.events.push({ uuid: msg.uuid, ...ev });
    push(msg);
    emit('user', { text: msg.message.content, from: `artifact ${a.id}` });
    return send(res, 202, { uuid: msg.uuid, status: 'queued' });
  }
  const file = path.join(a.dir, path.basename(rest));
  if (fs.existsSync(file)) return send(res, 200, fs.readFileSync(file), guessType(file));
  return send(res, 404, { error: 'not found' });
});

function guessType(f) {
  return ({ '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' })[path.extname(f)] ?? 'application/octet-stream';
}

server.listen(PORT, HOST, () => {
  console.log(`AISF bridge prototype on ${ORIGIN}  (project: ${PROJECT}, store: ${STORE})`);
  runSession().catch(e => { console.error(e); emit('system', { text: `session error: ${e.message}` }); });
});
