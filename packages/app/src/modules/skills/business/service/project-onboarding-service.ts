import type { SlotReader } from '../port/contract/slot-reader.js';
import { projectContract } from '../domain/constants/project-contract.js';
import { checkContract } from '../domain/functions/check-contract.js';
import type { ContractPreflightReport } from '../domain/types/contract-preflight-report.js';
import type { PluginInstallOutcome } from '../domain/types/plugin-install-outcome.js';
import { SkillsSetupError } from '../errors/skills-setup-error.js';
import type { LocalPluginInstaller } from '../port/plugin/local-plugin-installer.js';
import type { SkillsStartupService } from './skills-startup-service.js';

export type ProjectOnboardingServiceDependencies = {
  readonly slotReader: SlotReader;
  readonly localPluginInstaller: LocalPluginInstaller;
  readonly startupService: Pick<SkillsStartupService, 'waitForStart'>;
};

export class ProjectOnboardingService {
  constructor(private readonly dependencies: ProjectOnboardingServiceDependencies) {}

  async contractPreflight(checkoutPath: string): Promise<ContractPreflightReport> {
    const { slotReader } = this.dependencies;
    const entries = await Promise.all(
      projectContract.slots.map(
        async (slot) => [slot.name, await slotReader.read(checkoutPath, slot.name)] as const,
      ),
    );

    return checkContract(projectContract, new Map(entries));
  }

  async installPluginLocally(checkoutPath: string): Promise<PluginInstallOutcome> {
    await this.dependencies.startupService.waitForStart();
    try {
      await this.dependencies.localPluginInstaller.install(checkoutPath);
      return { state: 'installed' };
    } catch (error) {
      if (error instanceof SkillsSetupError) {
        return { state: 'failed', reason: error.message };
      }
      throw error;
    }
  }
}
