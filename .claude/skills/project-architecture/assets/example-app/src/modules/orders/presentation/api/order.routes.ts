import type { Routes } from "../../../../shared/http.js";
import type { OrderController } from "./order.controller.js";

export const orderRoutes = (c: OrderController): Routes => ({
  "POST /orders": c.place,
  "GET /users/:userId/orders": c.listForUser,
});
