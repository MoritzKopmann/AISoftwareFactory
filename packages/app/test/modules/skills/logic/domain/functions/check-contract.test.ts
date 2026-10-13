import { describe, expect, it } from 'vitest';
import { checkContract } from '../../../../../../src/modules/skills/logic/domain/functions/check-contract.js';
import type { ProjectContract } from '../../../../../../src/modules/skills/logic/domain/constants/project-contract.js';

const contract: ProjectContract = {
  slots: [
    { kind: 'skill', name: 'project-architecture' },
    { kind: 'skill', name: 'project-testing' },
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
  it('should pass when every skill slot exists and every key is present', () => {
    const slotTexts = new Map([
      ['project-architecture', 'any shape'],
      ['project-testing', 'any shape'],
      ['project-toolchain', completeToolchainText],
    ]);

    expect(checkContract(contract, slotTexts)).toEqual({
      passed: true,
      missingSlots: [],
      missingKeys: [],
    });
  });

  it('should list a slot as missing when its text is absent', () => {
    const slotTexts = new Map([
      ['project-testing', 'any shape'],
      ['project-toolchain', completeToolchainText],
    ]);

    const report = checkContract(contract, slotTexts);

    expect(report.passed).toBe(false);
    expect(report.missingSlots).toEqual(['project-architecture']);
  });

  it('should list every required key as missing when the toolchain fence is absent', () => {
    const slotTexts = new Map([
      ['project-architecture', 'any shape'],
      ['project-testing', 'any shape'],
      ['project-toolchain', 'no fence here'],
    ]);

    const report = checkContract(contract, slotTexts);

    expect(report.passed).toBe(false);
    expect(report.missingKeys).toEqual(['format', 'analyze', 'test']);
  });

  it('should list only the missing keys when the fence has some of them', () => {
    const slotTexts = new Map([
      ['project-architecture', 'any shape'],
      ['project-testing', 'any shape'],
      ['project-toolchain', ['```yaml aisf-toolchain', 'format: npm run format', '```'].join('\n')],
    ]);

    const report = checkContract(contract, slotTexts);

    expect(report.passed).toBe(false);
    expect(report.missingKeys).toEqual(['analyze', 'test']);
  });
});
