import type { ContractPreflightReport } from '../types/contract-preflight-report.js';
import type { ContractSlot, ProjectContract } from '../constants/project-contract.js';

const toolchainFencePattern = /```yaml aisf-toolchain\n([\s\S]*?)```/;
const topLevelKeyPattern = /^([A-Za-z_][A-Za-z0-9_]*):/gm;

function findToolchainKeys(slotText: string): ReadonlyArray<string> | undefined {
  const fenceMatch = toolchainFencePattern.exec(slotText);
  if (fenceMatch === null) {
    return undefined;
  }

  const fenceBody = fenceMatch[1] ?? '';
  return [...fenceBody.matchAll(topLevelKeyPattern)]
    .map((match) => match[1])
    .filter((key): key is string => key !== undefined);
}

function findMissingKeys(slot: ContractSlot, slotText: string): ReadonlyArray<string> {
  if (slot.kind !== 'toolchain') {
    return [];
  }

  const foundKeys = findToolchainKeys(slotText);
  if (foundKeys === undefined) {
    return slot.requiredKeys;
  }
  return slot.requiredKeys.filter((key) => !foundKeys.includes(key));
}

function findMissingHeadings(
  slot: ContractSlot,
  slotText: string,
): ReadonlyArray<{ readonly slot: string; readonly heading: string }> {
  if (slot.kind !== 'headings') {
    return [];
  }

  return slot.requiredHeadings
    .filter((heading) => !slotText.includes(heading))
    .map((heading) => ({ slot: slot.name, heading }));
}

export function checkContract(
  contract: ProjectContract,
  slotTexts: ReadonlyMap<string, string | undefined>,
): ContractPreflightReport {
  const missingSlots: string[] = [];
  const missingHeadings: Array<{ slot: string; heading: string }> = [];
  const missingKeys: string[] = [];

  for (const slot of contract.slots) {
    const slotText = slotTexts.get(slot.name);
    if (slotText === undefined) {
      missingSlots.push(slot.name);
      continue;
    }

    missingHeadings.push(...findMissingHeadings(slot, slotText));
    missingKeys.push(...findMissingKeys(slot, slotText));
  }

  return {
    passed: missingSlots.length === 0 && missingHeadings.length === 0 && missingKeys.length === 0,
    missingSlots,
    missingHeadings,
    missingKeys,
  };
}
