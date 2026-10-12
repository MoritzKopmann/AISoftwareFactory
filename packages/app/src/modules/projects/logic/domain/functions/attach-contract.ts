import type { ContractPreflightReport } from '../types/contract-preflight-report.js';
import type { Project } from '../types/project.js';
import type { ProjectWithContract } from '../types/project-with-contract.js';

export function attachContract(
  project: Project,
  contract: ContractPreflightReport,
): ProjectWithContract {
  return { ...project, contract };
}
