import { determineRunsBlocked } from './logic/domain/determine-runs-blocked.js';
import type { ContractPreflightReport } from './logic/domain/contract-preflight-report.js';
import type { PluginInstallOutcome } from './logic/domain/plugin-install-outcome.js';
import type { RunsBlocked, SkillsStatus } from './logic/domain/skills-status.js';
import type { LocalPluginInstaller } from './logic/ports/local-plugin-installer.js';
import {
  ContractPreflightUseCase,
  type ContractPreflightDependencies,
} from './logic/use-cases/contract-preflight-use-case.js';
import { InstallPluginLocallyUseCase } from './logic/use-cases/install-plugin-locally-use-case.js';
import {
  StartSkillsUseCase,
  type StartSkillsDependencies,
} from './logic/use-cases/start-skills-use-case.js';

export type { RunsBlocked, SkillsStatus } from './logic/domain/skills-status.js';
export type { ContractPreflightReport } from './logic/domain/contract-preflight-report.js';
export type { PluginInstallOutcome } from './logic/domain/plugin-install-outcome.js';

export type SkillsModuleDependencies = StartSkillsDependencies &
  ContractPreflightDependencies & {
    readonly localPluginInstaller: LocalPluginInstaller;
  };

export type SkillsModule = {
  readonly start: () => Promise<void>;
  readonly runsBlocked: () => RunsBlocked;
  readonly status: () => SkillsStatus;
  readonly runContractPreflight: (checkoutPath: string) => Promise<ContractPreflightReport>;
  readonly installPluginLocally: (checkoutPath: string) => Promise<PluginInstallOutcome>;
};

export function createSkillsModule(dependencies: SkillsModuleDependencies): SkillsModule {
  const startSkills = new StartSkillsUseCase(dependencies);
  const contractPreflight = new ContractPreflightUseCase(dependencies);
  const installPluginLocally = new InstallPluginLocallyUseCase({
    localPluginInstaller: dependencies.localPluginInstaller,
  });
  let status: SkillsStatus = { state: 'pending' };
  let startPromise: Promise<void> | undefined;

  return {
    start: () => {
      startPromise = startSkills.execute().then((result) => {
        status = result;
      });
      return startPromise;
    },
    runsBlocked: () => determineRunsBlocked(status),
    status: () => status,
    runContractPreflight: (checkoutPath) => contractPreflight.execute(checkoutPath),
    installPluginLocally: async (checkoutPath) => {
      if (startPromise !== undefined) {
        await startPromise;
      }
      return installPluginLocally.execute(checkoutPath);
    },
  };
}
