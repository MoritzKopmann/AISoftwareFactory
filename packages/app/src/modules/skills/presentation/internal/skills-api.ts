import type { ContractPreflightReportDto } from '../dto/internal/contract-preflight-report-dto.js';
import type { PluginInstallOutcomeDto } from '../dto/internal/plugin-install-outcome-dto.js';
import type { RunsBlockedDto } from '../dto/internal/runs-blocked-dto.js';

/** What other modules may ask of skills. */
export interface SkillsApi {
  runsBlocked(): RunsBlockedDto;
  runContractPreflight(checkoutPath: string): Promise<ContractPreflightReportDto>;
  installPluginLocally(checkoutPath: string): Promise<PluginInstallOutcomeDto>;
}
