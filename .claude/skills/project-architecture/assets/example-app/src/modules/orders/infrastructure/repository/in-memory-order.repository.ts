import type { Order } from "../../business/domain/order.js";
import type { OrderRepository } from "../../business/port/repository/order.repository.js";

export class InMemoryOrderRepository implements OrderRepository {
  private rows: Order[] = [];
  async save(order: Order) {
    this.rows.push(order);
  }
  async findByUser(userId: string) {
    return this.rows.filter((o) => o.userId === userId);
  }
}
