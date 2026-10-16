import { test } from "node:test";
import assert from "node:assert/strict";
import { UsersAdapter } from "./users.adapter.js";

test("maps users' summary/null onto exists true/false", async () => {
  const adapter = new UsersAdapter({
    getUserSummary: async (id) => (id === "u1" ? { id, name: "Ada" } : null),
  });
  assert.equal(await adapter.exists("u1"), true);
  assert.equal(await adapter.exists("nope"), false);
});
