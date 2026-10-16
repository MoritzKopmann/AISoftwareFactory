import type { ContractPreflightReport } from '../../domain/types/contract-preflight-report.js';
import type { PluginInstallResult } from '../../domain/types/plugin-install-result.js';

export interface SkillPort {
  check(checkoutPath: string): Promise<ContractPreflightReport>;
  install(checkoutPath: string): Promise<PluginInstallResult>;
}
