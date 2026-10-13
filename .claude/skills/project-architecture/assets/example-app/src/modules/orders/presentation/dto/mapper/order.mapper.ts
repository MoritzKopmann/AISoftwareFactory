import type { Order } from "../../../business/domain/order.js";
import type { OrderDto } from "../api/order.dto.js";

export const toOrderDto = (o: Order): OrderDto => ({
  id: o.id,
  userId: o.userId,
  lines: o.lines.map((l) => ({ ...l })),
  total: o.total,
  createdAt: o.createdAt.toISOString(),
});
