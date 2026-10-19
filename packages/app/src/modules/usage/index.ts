import type { UsageReader } from './business/port/sdk/usage-reader.js';
import type { UsageRepository } from './business/port/repository/usage-repository.js';
import { UsageRefreshService } from './business/service/usage-refresh-service.js';
import { UsageService } from './business/service/usage-service.js';
import { SqliteUsageRepository } from './infrastructure/repository/sqlite-usage-repository.js';
import { ClaudeAgentSdkUsageReader } from './infrastructure/sdk/claude-agent-sdk-usage-reader.js';
import { createUsageRoutes } from './presentation/api/usage-routes.js';
import { subscribeToUsageWindowObserved } from './presentation/bus/subscribe-to-usage-window-observed.js';
import { subscribeToWatchUpdated } from './presentation/bus/subscribe-to-watch-updated.js';
import { UsageFacade } from './presentation/internal/usage-facade.js';
import type { UsageModule, UsageModuleDependencies } from './presentation/internal/usage-module.js';

export type { UsageModule, UsageModuleDependencies } from './presentation/internal/usage-module.js';
export type { UsageApi } from './presentation/internal/usage-api.js';
export type { UsageStatusDto } from './presentation/dto/internal/usage-status-dto.js';

type UsageInfrastructure = {
  readonly usageRepository: UsageRepository;
  readonly usageReader: UsageReader;
};

export function createUsageModule(
  dependencies: UsageModuleDependencies,
  overrides: Partial<UsageInfrastructure> = {},
): UsageModule {
  const { usageRepository, usageReader }: UsageInfrastructure = {
    usageRepository: new SqliteUsageRepository(dependencies.database),
    usageReader: new ClaudeAgentSdkUsageReader({
      claudeExecutablePath: dependencies.claudeExecutablePath,
    }),
    ...overrides,
  };
  const usageService = new UsageService({ usageRepository, clock: dependencies.clock });
  subscribeToUsageWindowObserved(dependencies.events, usageService, dependencies.logger);
  const usageRefreshService = new UsageRefreshService({
    usageService,
    usageReader,
    clock: dependencies.clock,
  });
  subscribeToWatchUpdated(dependencies.events, usageRefreshService, dependencies.logger);
  const facade = new UsageFacade(usageService);

  return { routes: createUsageRoutes(usageService), jobs: {}, internal: facade };
}
