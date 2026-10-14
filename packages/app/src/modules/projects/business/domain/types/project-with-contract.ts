import type { ContractPreflightReport } from './contract-preflight-report.js';
import type { Project } from './project.js';

export type ProjectWithContract = Project & { readonly contract: ContractPreflightReport };
