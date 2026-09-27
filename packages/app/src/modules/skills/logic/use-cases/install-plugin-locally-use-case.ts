import type { PluginInstallOutcome } from '../domain/plugin-install-outcome.js';
import { SkillsSetupError } from '../errors/skills-setup-error.js';
import type { LocalPluginInstaller } from '../ports/local-plugin-installer.js';

export type InstallPluginLocallyDependencies = {
  readonly localPluginInstaller: LocalPluginInstaller;
};

export class InstallPluginLocallyUseCase {
  constructor(private readonly dependencies: InstallPluginLocallyDependencies) {}

  async execute(checkoutPath: string): Promise<PluginInstallOutcome> {
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
