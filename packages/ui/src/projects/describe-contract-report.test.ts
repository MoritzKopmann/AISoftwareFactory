import { describe, expect, it } from 'vitest';
import { describeContractReport } from './describe-contract-report.js';

describe('describeContractReport', () => {
  it('should say the contract pre-flight passed when nothing is missing', () => {
    const description = describeContractReport({
      passed: true,
      missingSlots: [],
      missingKeys: [],
    });

    expect(description).toEqual({ headline: 'Contract pre-flight passed', missingItems: [] });
  });

  it('should count and name a missing slot', () => {
    const description = describeContractReport({
      passed: false,
      missingSlots: ['project-architecture'],
      missingKeys: [],
    });

    expect(description).toEqual({
      headline: 'Contract pre-flight: 1 part missing',
      missingItems: ['project-architecture'],
    });
  });

  it('should list slots and keys and pluralize the count', () => {
    const description = describeContractReport({
      passed: false,
      missingSlots: ['project-testing'],
      missingKeys: ['test'],
    });

    expect(description).toEqual({
      headline: 'Contract pre-flight: 2 parts missing',
      missingItems: ['project-testing', 'test'],
    });
  });
});
