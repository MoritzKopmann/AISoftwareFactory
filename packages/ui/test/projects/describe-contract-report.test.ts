import { describe, expect, it } from 'vitest';
import { describeContractReport } from '../../src/projects/describe-contract-report.js';

describe('describeContractReport', () => {
  it('should say the contract pre-flight passed when nothing is missing', () => {
    const description = describeContractReport({
      passed: true,
      missingSlots: [],
      missingHeadings: [],
      missingKeys: [],
    });

    expect(description).toEqual({ headline: 'Contract pre-flight passed', missingItems: [] });
  });

  it('should count and name a missing slot', () => {
    const description = describeContractReport({
      passed: false,
      missingSlots: ['project-architecture'],
      missingHeadings: [],
      missingKeys: [],
    });

    expect(description).toEqual({
      headline: 'Contract pre-flight: 1 part missing',
      missingItems: ['project-architecture'],
    });
  });

  it('should name a missing heading with its slot and pluralize the count', () => {
    const description = describeContractReport({
      passed: false,
      missingSlots: [],
      missingHeadings: [{ slot: 'project-architecture', heading: '## Hard bans' }],
      missingKeys: ['format'],
    });

    expect(description).toEqual({
      headline: 'Contract pre-flight: 2 parts missing',
      missingItems: ['project-architecture: ## Hard bans', 'format'],
    });
  });
});
