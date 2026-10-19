import { Hono } from 'hono';
import type { UsageRepository } from './business/port/repository/usage-repository.js';
import { UsageService } from './business/service/usage-service.js';
import { SqliteUsageRepository } from './infrastructure/repository/sqlite-usage-repository.js';
import type { UsageModule, UsageModuleDependencies } from './presentation/internal/usage-module.js';

export type { UsageModule, UsageModuleDependencies } from './presentation/internal/usage-module.js';

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
  // TODO(#599): expose the service through the module's internal API.
  new UsageService({ usageRepository, clock: dependencies.clock });

  return { routes: new Hono(), jobs: {}, internal: {} };
}
