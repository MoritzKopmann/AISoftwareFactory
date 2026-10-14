import type { SkillsApi } from '../../../skills/index.js';
import type { PluginInstallResult } from '../../business/domain/types/plugin-install-result.js';
import type { PluginInstaller } from '../../business/port/plugin/plugin-installer.js';

export class SkillsPluginInstaller implements PluginInstaller {
  constructor(private readonly skills: Pick<SkillsApi, 'installPluginLocally'>) {}

  async install(checkoutPath: string): Promise<PluginInstallResult> {
    const outcome = await this.skills.installPluginLocally(checkoutPath);
    return outcome.state === 'failed'
      ? { state: 'failed', reason: outcome.reason }
      : { state: 'installed' };
  }
}
