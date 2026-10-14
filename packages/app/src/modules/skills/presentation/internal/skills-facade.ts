import type { ProjectOnboardingService } from '../../business/service/project-onboarding-service.js';
import type { SkillsStartupService } from '../../business/service/skills-startup-service.js';
import type { ContractPreflightReportDto } from '../dto/internal/contract-preflight-report-dto.js';
import type { PluginInstallOutcomeDto } from '../dto/internal/plugin-install-outcome-dto.js';
import type { RunsBlockedDto } from '../dto/internal/runs-blocked-dto.js';
import { toContractPreflightReportDto } from '../dto/mapper/contract-preflight-report-mapper.js';
import { toPluginInstallOutcomeDto } from '../dto/mapper/plugin-install-outcome-mapper.js';
import { toRunsBlockedDto } from '../dto/mapper/runs-blocked-mapper.js';
import type { SkillsApi } from './skills-api.js';

export class SkillsFacade implements SkillsApi {
  constructor(
    private readonly startupService: SkillsStartupService,
    private readonly onboardingService: ProjectOnboardingService,
  ) {}

  runsBlocked(): RunsBlockedDto {
    return toRunsBlockedDto(this.startupService.readRunsBlocked());
  }

  async runContractPreflight(checkoutPath: string): Promise<ContractPreflightReportDto> {
    return toContractPreflightReportDto(
      await this.onboardingService.contractPreflight(checkoutPath),
    );
  }

  async installPluginLocally(checkoutPath: string): Promise<PluginInstallOutcomeDto> {
    return toPluginInstallOutcomeDto(
      await this.onboardingService.installPluginLocally(checkoutPath),
    );
  }
}
