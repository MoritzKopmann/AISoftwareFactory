// USE CASES for orders.
import { randomUUID } from "node:crypto";
import type { EventBus } from "../../../../shared/event-bus.js";
import { NotFoundError, ValidationError } from "../../../../shared/errors.js";
import type { UserPort } from "../port/user/user.port.js";
import type { Order, OrderLine } from "../domain/order.js";
import type { OrderRepository } from "../port/repository/order.repository.js";

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly users: UserPort,
    private readonly bus: EventBus,
  ) {}

  async place(userId: string, lines: OrderLine[]): Promise<Order> {
    if (!lines?.length) throw new ValidationError("Order needs at least one line");
    if (lines.some((l) => l.qty <= 0 || l.unitPrice < 0)) throw new ValidationError("Invalid line");
    // Synchronous cross-module call: we need the answer now to accept or reject.
    if (!(await this.users.exists(userId))) throw new NotFoundError(`Customer ${userId} not found`);

    const total = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
    const order: Order = { id: randomUUID(), userId, lines, total, createdAt: new Date() };
    await this.orders.save(order);

    // Asynchronous notification: orders doesn't know or care who listens.
    await this.bus.publish("order.placed", { orderId: order.id, userId, total });
    return order;
  }

  listForUser(userId: string) {
    return this.orders.findByUser(userId);
  }
}
