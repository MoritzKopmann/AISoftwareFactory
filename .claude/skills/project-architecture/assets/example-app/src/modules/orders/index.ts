// MODULE ENTRY for orders.
import type { EventBus } from "../../shared/event-bus.js";
import type { UsersApi } from "../users/index.js";
import type { OrderRepository } from "./business/port/repository/order.repository.js";
import { OrderService } from "./business/service/order.service.js";
import { UsersCustomerLookup } from "./infrastructure/internal/users-customer-lookup.js";
import { InMemoryOrderRepository } from "./infrastructure/repository/in-memory-order.repository.js";
import { OrderController } from "./presentation/api/order.controller.js";
import { orderRoutes } from "./presentation/api/order.routes.js";

export interface OrdersModuleDeps {
  bus: EventBus;
  users: UsersApi; // other module's internal API — adapted in infrastructure/internal
  repo?: OrderRepository;
}

export function createOrdersModule(deps: OrdersModuleDeps) {
  const service = new OrderService(
    deps.repo ?? new InMemoryOrderRepository(),
    new UsersCustomerLookup(deps.users),
    deps.bus,
  );
  return {
    routes: orderRoutes(new OrderController(service)),
    jobs: {}, // cron / CLI entry points from presentation/cron, presentation/cli
    internal: {}, // orders offers nothing to other modules (yet)
  };
}
