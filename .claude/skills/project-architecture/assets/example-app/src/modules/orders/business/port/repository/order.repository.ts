import type { Order } from "../../domain/order.js";

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findByUser(userId: string): Promise<Order[]>;
}
