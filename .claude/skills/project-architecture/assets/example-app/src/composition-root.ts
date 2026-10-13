// APP COMPOSITION ROOT.
// 1. Create shared infrastructure (bus, DB pool, config).
// 2. Call each module's index.ts in dependency order, passing the internal facades it needs.
// 3. Collect every module's routes and jobs for the transports that run them.
// No business logic, no module-internal classes — only index.ts imports.
import { InMemoryEventBus } from "./shared/in-memory-event-bus.js";
import type { Routes } from "./shared/http.js";
import type { Jobs } from "./shared/jobs.js";
import { createUsersModule } from "./modules/users/index.js";
import { createOrdersModule } from "./modules/orders/index.js";
import { createNotificationsModule } from "./modules/notifications/index.js";

export function buildApp(): { routes: Routes; jobs: Jobs } {
  const bus = new InMemoryEventBus();

  const users = createUsersModule({ bus });
  const orders = createOrdersModule({ bus, users: users.internal.users });
  const notifications = createNotificationsModule({ bus });

  return {
    routes: { ...users.routes, ...orders.routes, ...notifications.routes },
    jobs: { ...users.jobs, ...orders.jobs, ...notifications.jobs },
  };
}
