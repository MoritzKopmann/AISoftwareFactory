// Entry point: a tiny node:http server over the route table (swap for Express/Fastify freely —
// only this file would change). Run with `--demo` to exercise the flow without curl.
import { createServer } from "node:http";
import { buildApp } from "./composition-root.js";
import type { HttpRequest, HttpResponse } from "./shared/http.js";

const { routes } = buildApp();
type Handler = (req: HttpRequest) => Promise<HttpResponse>;

function match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  for (const [key, handler] of Object.entries(routes)) {
    const [m, pattern] = key.split(" ");
    if (m !== method) continue;
    const a = pattern.split("/"), b = path.split("/");
    if (a.length !== b.length) continue;
    const params: Record<string, string> = {};
    if (a.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = b[i]), true) : seg === b[i])))
      return { handler, params };
  }
  return null;
}

async function call(method: string, path: string, body?: unknown) {
  const hit = match(method, path);
  return hit ? hit.handler({ params: hit.params, body }) : { status: 404, body: { error: "No route" } };
}

if (process.argv.includes("--demo")) {
  const log = (label: string, r: HttpResponse) => console.log(`${label} -> ${r.status}`, JSON.stringify(r.body));
  const created = await call("POST", "/users", { email: "ada@example.com", name: "Ada" });
  log("POST /users", created);
  const userId = (created.body as { id: string }).id;
  log("POST /users (dup)", await call("POST", "/users", { email: "ada@example.com", name: "Ada" }));
  log("POST /orders", await call("POST", "/orders", { userId, lines: [{ sku: "BOOK-1", qty: 2, unitPrice: 19.5 }] }));
  log("POST /orders (bad user)", await call("POST", "/orders", { userId: "nope", lines: [{ sku: "X", qty: 1, unitPrice: 1 }] }));
  log(`GET /users/:id/orders`, await call("GET", `/users/${userId}/orders`));
} else {
  createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const r = await call(req.method ?? "GET", (req.url ?? "/").split("?")[0], raw ? JSON.parse(raw) : undefined);
    res.writeHead(r.status, { "content-type": "application/json" }).end(JSON.stringify(r.body));
  }).listen(3000, () => console.log("Listening on http://localhost:3000"));
}
