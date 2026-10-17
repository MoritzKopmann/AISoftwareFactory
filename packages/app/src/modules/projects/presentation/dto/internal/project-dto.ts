import type { ContractPreflightReportDto } from './contract-preflight-report-dto.js';

export type ProjectDto = {
  readonly id: string;
  readonly repository: { readonly owner: string; readonly name: string };
  readonly checkoutPath: string;
  readonly addedAt: string;
  readonly paused: boolean;
  readonly contract: ContractPreflightReportDto;
};
