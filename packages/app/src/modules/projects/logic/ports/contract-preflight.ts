import type { ContractPreflightReport } from '../domain/types/contract-preflight-report.js';

export type ContractPreflight = {
  readonly check: (checkoutPath: string) => Promise<ContractPreflightReport>;
};
