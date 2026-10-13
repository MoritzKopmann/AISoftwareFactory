// Business logic tested with plain fakes — no infrastructure imports needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { EventBus } from "../../../../shared/event-bus.js";
import type { Order } from "../domain/order.js";
import type { OrderRepository } from "../repository/order.repository.js";
import { OrderService } from "./order.service.js";

const fakes = (customerExists: boolean) => {
  const published: unknown[] = [];
  const saved: Order[] = [];
  const bus: EventBus = { publish: async (e, p) => void published.push([e, p]), subscribe: () => {} };
  const repo: OrderRepository = { save: async (o) => void saved.push(o), findByUser: async () => saved };
  const svc = new OrderService(repo, { exists: async () => customerExists }, bus);
  return { svc, published, saved };
};

test("rejects orders for unknown customers and publishes nothing", async () => {
  const { svc, published, saved } = fakes(false);
  await assert.rejects(svc.place("u1", [{ sku: "A", qty: 1, unitPrice: 5 }]), /not found/);
  assert.equal(published.length, 0);
  assert.equal(saved.length, 0);
});

test("computes total and publishes order.placed", async () => {
  const { svc, published } = fakes(true);
  const order = await svc.place("u1", [{ sku: "A", qty: 3, unitPrice: 2.5 }]);
  assert.equal(order.total, 7.5);
  assert.deepEqual(published[0], ["order.placed", { orderId: order.id, userId: "u1", total: 7.5 }]);
});
