import { checkContract } from '../domain/check-contract.js';
import type { ContractPreflightReport } from '../domain/contract-preflight-report.js';
import { projectContract } from '../domain/project-contract.js';
import type { SlotReader } from '../ports/slot-reader.js';

export type ContractPreflightDependencies = {
  readonly slotReader: SlotReader;
};

export class ContractPreflightUseCase {
  constructor(private readonly dependencies: ContractPreflightDependencies) {}

  async execute(checkoutPath: string): Promise<ContractPreflightReport> {
    const { slotReader } = this.dependencies;
    const entries = await Promise.all(
      projectContract.slots.map(
        async (slot) => [slot.name, await slotReader.read(checkoutPath, slot.name)] as const,
      ),
    );

    return checkContract(projectContract, new Map(entries));
  }
}
