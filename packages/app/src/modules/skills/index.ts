import { SkillsStartupService } from './business/service/skills-startup-service.js';
import { ProjectOnboardingService } from './business/service/project-onboarding-service.js';
import type { SlotReader } from './business/port/contract/slot-reader.js';
import type { CredentialSource } from './business/port/credential/credential-source.js';
import type { LocalPluginInstaller } from './business/port/plugin/local-plugin-installer.js';
import type { MarketplaceRegistry } from './business/port/plugin/marketplace-registry.js';
import type { PluginMirror } from './business/port/plugin/plugin-mirror.js';
import type { SkillsStatusRepository } from './business/port/repository/skills-status-repository.js';
import type { SmokeProbe } from './business/port/smoke/smoke-probe.js';
import { GitRefSlotReader } from './infrastructure/contract/git-ref-slot-reader.js';
import { EnvironmentCredentialSource } from './infrastructure/credential/environment-credential-source.js';
import { ClaudeCliLocalPluginInstaller } from './infrastructure/plugin/claude-cli-local-plugin-installer.js';
import { ClaudeCliMarketplaceRegistry } from './infrastructure/plugin/claude-cli-marketplace-registry.js';
import { FileSystemPluginMirror } from './infrastructure/plugin/file-system-plugin-mirror.js';
import { InMemorySkillsStatusRepository } from './infrastructure/repository/in-memory-skills-status-repository.js';
import { ClaudeCliSmokeProbe } from './infrastructure/smoke/claude-cli-smoke-probe.js';
import { createSkillsRoutes } from './presentation/api/skills-routes.js';
import { createSkillsStartUpChecksJob } from './presentation/cron/skills-start-up-checks-job.js';
import { SkillsFacade } from './presentation/internal/skills-facade.js';
import type {
  SkillsModule,
  SkillsModuleDependencies,
} from './presentation/internal/skills-module.js';

export type { SkillsApi } from './presentation/internal/skills-api.js';
export type {
  SkillsModule,
  SkillsModuleDependencies,
} from './presentation/internal/skills-module.js';
export type { ContractPreflightReportDto } from './presentation/dto/internal/contract-preflight-report-dto.js';
export type { PluginInstallOutcomeDto } from './presentation/dto/internal/plugin-install-outcome-dto.js';
export type { RunsBlockedDto } from './presentation/dto/internal/runs-blocked-dto.js';

type SkillsInfrastructure = {
  readonly pluginMirror: PluginMirror;
  readonly marketplaceRegistry: MarketplaceRegistry;
  readonly smokeProbe: SmokeProbe;
  readonly slotReader: SlotReader;
  readonly localPluginInstaller: LocalPluginInstaller;
  readonly credentialSource: CredentialSource;
  readonly statusRepository: SkillsStatusRepository;
};

export function createSkillsModule(
  dependencies: SkillsModuleDependencies,
  overrides: Partial<SkillsInfrastructure> = {},
): SkillsModule {
  const infrastructure: SkillsInfrastructure = {
    pluginMirror: new FileSystemPluginMirror({
      sourceDirectory: dependencies.pluginDirectory,
      mirrorDirectory: dependencies.mirrorDirectory,
    }),
    marketplaceRegistry: new ClaudeCliMarketplaceRegistry(),
    smokeProbe: new ClaudeCliSmokeProbe({
      probeDirectory: dependencies.probeDirectory,
      pluginDirectory: dependencies.mirrorDirectory,
    }),
    slotReader: new GitRefSlotReader(),
    localPluginInstaller: new ClaudeCliLocalPluginInstaller(),
    credentialSource: new EnvironmentCredentialSource({
      environment: dependencies.environment,
      projectDirectory: dependencies.projectDirectory,
    }),
    statusRepository: new InMemorySkillsStatusRepository(),
    ...overrides,
  };
  const startupService = new SkillsStartupService({
    ...infrastructure,
    mirrorDirectory: dependencies.mirrorDirectory,
    events: dependencies.events,
  });
  const onboardingService = new ProjectOnboardingService({ ...infrastructure, startupService });
  return {
    routes: createSkillsRoutes(startupService),
    jobs: {
      'skills.start-up-checks': createSkillsStartUpChecksJob(startupService, dependencies.logger),
    },
    internal: new SkillsFacade(startupService, onboardingService),
  };
}
