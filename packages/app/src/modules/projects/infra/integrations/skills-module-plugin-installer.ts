import type { PluginInstallResult } from '../../logic/domain/types/plugin-install-result.js';
import type { PluginInstaller } from '../../logic/ports/plugin-installer.js';
import type { SkillsModule } from '../../../skills/index.js';

export class SkillsModulePluginInstaller implements PluginInstaller {
  constructor(private readonly skills: Pick<SkillsModule, 'installPluginLocally'>) {}

  install(checkoutPath: string): Promise<PluginInstallResult> {
    return this.skills.installPluginLocally(checkoutPath);
  }
}
