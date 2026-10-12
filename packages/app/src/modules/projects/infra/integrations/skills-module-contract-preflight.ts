import type { ContractPreflightReport } from '../../logic/domain/types/contract-preflight-report.js';
import type { ContractPreflight } from '../../logic/ports/contract-preflight.js';
import type { SkillsModule } from '../../../skills/index.js';

export class SkillsModuleContractPreflight implements ContractPreflight {
  constructor(private readonly skills: Pick<SkillsModule, 'runContractPreflight'>) {}

  check(checkoutPath: string): Promise<ContractPreflightReport> {
    return this.skills.runContractPreflight(checkoutPath);
  }
}
