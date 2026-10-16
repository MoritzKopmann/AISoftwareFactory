import type { SkillsApi } from '../../../skills/index.js';
import type { ContractPreflightReport } from '../../business/domain/types/contract-preflight-report.js';
import type { PluginInstallResult } from '../../business/domain/types/plugin-install-result.js';
import type { SkillPort } from '../../business/port/skill/skill-port.js';

export class SkillsAdapter implements SkillPort {
  constructor(
    private readonly skills: Pick<SkillsApi, 'runContractPreflight' | 'installPluginLocally'>,
  ) {}

  async check(checkoutPath: string): Promise<ContractPreflightReport> {
    const report = await this.skills.runContractPreflight(checkoutPath);
    return {
      passed: report.passed,
      missingSlots: report.missingSlots,
      missingKeys: report.missingKeys,
    };
  }

  async install(checkoutPath: string): Promise<PluginInstallResult> {
    const outcome = await this.skills.installPluginLocally(checkoutPath);
    return outcome.state === 'failed'
      ? { state: 'failed', reason: outcome.reason }
      : { state: 'installed' };
  }
}
