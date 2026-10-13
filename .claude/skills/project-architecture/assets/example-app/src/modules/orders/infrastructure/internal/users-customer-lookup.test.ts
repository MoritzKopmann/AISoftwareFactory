import { test } from "node:test";
import assert from "node:assert/strict";
import { UsersCustomerLookup } from "./users-customer-lookup.js";

test("maps users' summary/null onto exists true/false", async () => {
  const lookup = new UsersCustomerLookup({
    getUserSummary: async (id) => (id === "u1" ? { id, name: "Ada" } : null),
  });
  assert.equal(await lookup.exists("u1"), true);
  assert.equal(await lookup.exists("nope"), false);
});
