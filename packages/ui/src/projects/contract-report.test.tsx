import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContractReport } from './contract-report.js';

describe('ContractReport', () => {
  it('should render nothing when the contract check passed', () => {
    const markup = renderToStaticMarkup(
      <ContractReport report={{ passed: true, missingSlots: [], missingKeys: [] }} />,
    );

    expect(markup).toBe('');
  });

  it('should render an alert with the warn mark, the headline and each missing part when the check failed', () => {
    const markup = renderToStaticMarkup(
      <ContractReport
        report={{
          passed: false,
          missingSlots: ['project-testing', 'project-toolchain'],
          missingKeys: [],
        }}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('▲');
    expect(markup).toContain('Contract pre-flight: 2 parts missing');
    expect(markup).toContain('project-testing');
    expect(markup).toContain('project-toolchain');
  });

  it('should render no list when the check failed with nothing to name', () => {
    const markup = renderToStaticMarkup(
      <ContractReport report={{ passed: false, missingSlots: [], missingKeys: [] }} />,
    );

    expect(markup).not.toContain('<ul');
  });
});
