// MODULE ENTRY. Wires this module's classes together.
// IN:  every external dependency (shared infra + other modules' internal APIs) + optional overrides.
// OUT: routes (HTTP), jobs (cron/CLI) and internal facades other modules may use.
import type { EventBus } from "../../shared/event-bus.js";
import type { UserRepository } from "./business/repository/user.repository.js";
import { UserService } from "./business/service/user.service.js";
import { InMemoryUserRepository } from "./infrastructure/repository/in-memory-user.repository.js";
import { UserController } from "./presentation/api/user.controller.js";
import { userRoutes } from "./presentation/api/user.routes.js";
import { UsersFacade } from "./presentation/internal/users.facade.js";

// Public contract: only presentation/internal + its DTOs. Nothing from business/ is exported.
export type { UsersApi } from "./presentation/internal/users.api.js";
export type { UserSummary } from "./presentation/dto/internal/user-summary.dto.js";

export interface UsersModuleDeps {
  bus: EventBus;
  repo?: UserRepository; // override for tests / other environments
}

export function createUsersModule(deps: UsersModuleDeps) {
  const service = new UserService(deps.repo ?? new InMemoryUserRepository(), deps.bus);
  return {
    routes: userRoutes(new UserController(service)),
    jobs: {}, // cron / CLI entry points from presentation/cron, presentation/cli
    internal: { users: new UsersFacade(service) },
  };
}
