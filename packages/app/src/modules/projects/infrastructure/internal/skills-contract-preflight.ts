import type { SkillsApi } from '../../../skills/index.js';
import type { ContractPreflight } from '../../business/port/contract/contract-preflight.js';
import type { ContractPreflightReport } from '../../business/domain/types/contract-preflight-report.js';

export class SkillsContractPreflight implements ContractPreflight {
  constructor(private readonly skills: Pick<SkillsApi, 'runContractPreflight'>) {}

  async check(checkoutPath: string): Promise<ContractPreflightReport> {
    const report = await this.skills.runContractPreflight(checkoutPath);
    return {
      passed: report.passed,
      missingSlots: report.missingSlots,
      missingKeys: report.missingKeys,
    };
  }
}
