import { describe, expect, it } from 'vitest';
import { checkContract } from '../../../../../../src/modules/skills/logic/domain/functions/check-contract.js';
import type { ProjectContract } from '../../../../../../src/modules/skills/logic/domain/constants/project-contract.js';

const contract: ProjectContract = {
  slots: [
    {
      kind: 'headings',
      name: 'project-architecture',
      requiredHeadings: ['## Stack', '## Hard bans'],
    },
    { kind: 'headings', name: 'project-testing', requiredHeadings: ['## Mechanics'] },
    {
      kind: 'toolchain',
      name: 'project-toolchain',
      requiredKeys: ['format', 'analyze', 'test'],
    },
  ],
};

const completeToolchainText = [
  '```yaml aisf-toolchain',
  'format: npm run format',
  'analyze: npm run analyze',
  'test: npm test',
  '```',
].join('\n');

describe('checkContract', () => {
  it('should pass when every slot has every heading and key', () => {
    const slotTexts = new Map([
      ['project-architecture', '## Stack\n## Hard bans'],
      ['project-testing', '## Mechanics'],
      ['project-toolchain', completeToolchainText],
    ]);

    expect(checkContract(contract, slotTexts)).toEqual({
      passed: true,
      missingSlots: [],
      missingHeadings: [],
      missingKeys: [],
    });
  });

  it('should list a slot as missing when its text is absent, without listing its headings', () => {
    const slotTexts = new Map([
      ['project-testing', '## Mechanics'],
      ['project-toolchain', completeToolchainText],
    ]);

    const report = checkContract(contract, slotTexts);

    expect(report.passed).toBe(false);
    expect(report.missingSlots).toEqual(['project-architecture']);
    expect(report.missingHeadings).toEqual([]);
  });

  it('should list a missing heading by slot and heading name', () => {
    const slotTexts = new Map([
      ['project-architecture', '## Stack'],
      ['project-testing', '## Mechanics'],
      ['project-toolchain', completeToolchainText],
    ]);

    const report = checkContract(contract, slotTexts);

    expect(report.passed).toBe(false);
    expect(report.missingHeadings).toEqual([
      { slot: 'project-architecture', heading: '## Hard bans' },
    ]);
  });

  it('should list every required key as missing when the toolchain fence is absent', () => {
    const slotTexts = new Map([
      ['project-architecture', '## Stack\n## Hard bans'],
      ['project-testing', '## Mechanics'],
      ['project-toolchain', 'no fence here'],
    ]);

    const report = checkContract(contract, slotTexts);

    expect(report.passed).toBe(false);
    expect(report.missingKeys).toEqual(['format', 'analyze', 'test']);
  });

  it('should list only the missing keys when the fence has some of them', () => {
    const slotTexts = new Map([
      ['project-architecture', '## Stack\n## Hard bans'],
      ['project-testing', '## Mechanics'],
      ['project-toolchain', ['```yaml aisf-toolchain', 'format: npm run format', '```'].join('\n')],
    ]);

    const report = checkContract(contract, slotTexts);

    expect(report.passed).toBe(false);
    expect(report.missingKeys).toEqual(['analyze', 'test']);
  });
});
