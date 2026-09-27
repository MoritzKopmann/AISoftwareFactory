import type { ContractPreflightReport } from '../domain/contract-preflight-report.js';

export type ContractPreflight = {
  readonly check: (checkoutPath: string) => Promise<ContractPreflightReport>;
};
