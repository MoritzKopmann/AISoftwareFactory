import type { ContractPreflightReport } from '../../../business/domain/types/contract-preflight-report.js';
import type { ContractPreflightReportDto } from '../internal/contract-preflight-report-dto.js';

export function toContractPreflightReportDto(
  report: ContractPreflightReport,
): ContractPreflightReportDto {
  return {
    passed: report.passed,
    missingSlots: report.missingSlots,
    missingKeys: report.missingKeys,
  };
}
