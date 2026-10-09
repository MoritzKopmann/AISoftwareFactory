import { Hono } from 'hono';
import { createSkillsStatusRoutes } from './api/routes/create-skills-status-routes.js';
import type { ContractPreflightReport } from './logic/domain/types/contract-preflight-report.js';
import type { PluginInstallOutcome } from './logic/domain/types/plugin-install-outcome.js';
import type { RunsBlocked } from './logic/domain/types/skills-status.js';
import type { LocalPluginInstaller } from './logic/ports/local-plugin-installer.js';
import {
  ContractPreflightUseCase,
  type ContractPreflightDependencies,
} from './logic/use-cases/contract-preflight-use-case.js';
import type { EventPublisher } from '../../shared/bus/event-publisher.js';
import type { SkillsStatusStore } from './logic/ports/skills-status-store.js';
import { ReadRunsBlockedUseCase } from './logic/use-cases/read-runs-blocked-use-case.js';
import { ReadSkillsStatusUseCase } from './logic/use-cases/read-skills-status-use-case.js';
import { InstallPluginLocallyUseCase } from './logic/use-cases/install-plugin-locally-use-case.js';
import {
  StartSkillsUseCase,
  type StartSkillsDependencies,
} from './logic/use-cases/start-skills-use-case.js';

export type { RunsBlocked, SkillsStatus } from './logic/domain/types/skills-status.js';
export type { ContractPreflightReport } from './logic/domain/types/contract-preflight-report.js';
export type { PluginInstallOutcome } from './logic/domain/types/plugin-install-outcome.js';

export type SkillsModuleDependencies = StartSkillsDependencies &
  ContractPreflightDependencies & {
    readonly localPluginInstaller: LocalPluginInstaller;
    readonly statusStore: SkillsStatusStore;
    readonly events: EventPublisher;
  };

export type SkillsModule = {
  readonly start: () => Promise<void>;
  readonly runsBlocked: () => RunsBlocked;
  readonly routes: Hono;
  readonly runContractPreflight: (checkoutPath: string) => Promise<ContractPreflightReport>;
  readonly installPluginLocally: (checkoutPath: string) => Promise<PluginInstallOutcome>;
};

export function createSkillsModule(dependencies: SkillsModuleDependencies): SkillsModule {
  const startSkills = new StartSkillsUseCase(dependencies);
  const readSkillsStatus = new ReadSkillsStatusUseCase(dependencies);
  const readRunsBlocked = new ReadRunsBlockedUseCase(dependencies);
  const contractPreflight = new ContractPreflightUseCase(dependencies);
  const installPluginLocally = new InstallPluginLocallyUseCase({
    localPluginInstaller: dependencies.localPluginInstaller,
  });
  let startPromise: Promise<void> | undefined;

  return {
    start: () => {
      startPromise = startSkills.execute();
      return startPromise;
    },
    runsBlocked: () => readRunsBlocked.execute(),
    routes: new Hono().route('/skills', createSkillsStatusRoutes(readSkillsStatus)),
    runContractPreflight: (checkoutPath) => contractPreflight.execute(checkoutPath),
    installPluginLocally: async (checkoutPath) => {
      if (startPromise !== undefined) {
        await startPromise;
      }
      return installPluginLocally.execute(checkoutPath);
    },
  };
}
