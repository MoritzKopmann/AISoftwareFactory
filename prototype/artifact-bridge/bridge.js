// Injected into every served artifact. The whole page-side API: window.aisf.
//   aisf.send(type, data)  -> POST to the app, which pushes it into the session as a user message.
//                             Resolves { uuid, status:'queued' }; aisf.on('ack') fires when consumed.
//   aisf.state.save(obj) / aisf.state.load()  -> answers persisted by the app (survive reloads,
//                             readable by the agent), replacing claude.ai's artifact.publish(html).
//   aisf.on(event, fn)     -> 'ack' | 'reload' | 'status'
(() => {
  const cfg = window.__AISF__;
  const base = `/a/${cfg.id}/`;
  const headers = { 'content-type': 'application/json', 'x-aisf-token': cfg.token };
  const handlers = {};
  const fire = (ev, d) => (handlers[ev] ?? []).forEach(fn => fn(d));

  const stream = new EventSource(`${base}_stream?t=${cfg.token}`);
  stream.addEventListener('ack', e => fire('ack', JSON.parse(e.data)));
  stream.addEventListener('reload', e => {
    const d = JSON.parse(e.data);
    fire('reload', d);
    if (d.version !== cfg.version) location.reload(); // agent republished: show the new round
  });
  stream.onerror = () => fire('status', { connected: false });
  stream.onopen = () => fire('status', { connected: true });

  window.aisf = {
    version: cfg.version,
    on(ev, fn) { (handlers[ev] ??= []).push(fn); },
    async send(type, data) {
      const r = await fetch(`${base}_events`, { method: 'POST', headers, body: JSON.stringify({ type, data, at: Date.now() }) });
      if (!r.ok) throw new Error(`aisf.send failed: ${r.status}`);
      return r.json();
    },
    state: {
      async load() { return (await fetch(`${base}_state`, { headers })).json(); },
      async save(obj) { await fetch(`${base}_state`, { method: 'PUT', headers, body: JSON.stringify(obj) }); },
    },
  };
})();
