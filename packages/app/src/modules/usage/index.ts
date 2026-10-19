import type { UsageRepository } from './business/port/repository/usage-repository.js';
import { UsageService } from './business/service/usage-service.js';
import { SqliteUsageRepository } from './infrastructure/repository/sqlite-usage-repository.js';
import { createUsageRoutes } from './presentation/api/usage-routes.js';
import { subscribeToUsageWindowObserved } from './presentation/bus/subscribe-to-usage-window-observed.js';
import { UsageFacade } from './presentation/internal/usage-facade.js';
import type { UsageModule, UsageModuleDependencies } from './presentation/internal/usage-module.js';

export type { UsageModule, UsageModuleDependencies } from './presentation/internal/usage-module.js';
export type { UsageApi } from './presentation/internal/usage-api.js';
export type { UsageStatusDto } from './presentation/dto/internal/usage-status-dto.js';

type UsageInfrastructure = {
  readonly usageRepository: UsageRepository;
};

export function createUsageModule(
  dependencies: UsageModuleDependencies,
  overrides: Partial<UsageInfrastructure> = {},
): UsageModule {
  const { usageRepository }: UsageInfrastructure = {
    usageRepository: new SqliteUsageRepository(dependencies.database),
    ...overrides,
  };
  const usageService = new UsageService({ usageRepository, clock: dependencies.clock });
  subscribeToUsageWindowObserved(dependencies.events, usageService, dependencies.logger);
  const facade = new UsageFacade(usageService);

  return { routes: createUsageRoutes(usageService), jobs: {}, internal: facade };
}
