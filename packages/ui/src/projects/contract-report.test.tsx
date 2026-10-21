import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContractPreflightReportResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { ContractReport, StartOnboardingView } from './contract-report.js';
import type { StartOnboardingDescription } from './describe-start-onboarding.js';

const failedReport: ContractPreflightReportResponse = {
  passed: false,
  missingSlots: ['project-architecture', 'code-rules'],
  missingKeys: [],
};

function render(
  report: ContractPreflightReportResponse,
  tickets?: ReadonlyArray<Pick<TicketResponse, 'status' | 'types'>>,
): string {
  return renderToStaticMarkup(<ContractReport report={report} projectId="o/n" tickets={tickets} />);
}

function renderAction(description: StartOnboardingDescription): string {
  return renderToStaticMarkup(
    <StartOnboardingView description={description} onPress={() => undefined} />,
  );
}

describe('ContractReport', () => {
  it('should render nothing when the contract check passed', () => {
    const markup = render({ passed: true, missingSlots: [], missingKeys: [] }, []);

    expect(markup).toBe('');
  });

  it('should render an alert with the warn mark, the headline and each missing part when the check failed', () => {
    const markup = render(
      { passed: false, missingSlots: ['project-testing', 'project-toolchain'], missingKeys: [] },
      [],
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('▲');
    expect(markup).toContain('Contract pre-flight: 2 parts missing');
    expect(markup).toContain('project-testing');
    expect(markup).toContain('project-toolchain');
  });

  it('should render no list when the check failed with nothing to name', () => {
    const markup = render({ passed: false, missingSlots: [], missingKeys: [] }, []);

    expect(markup).not.toContain('<ul');
  });

  it('should render a primary Start onboarding button after the list when no onboard ticket is open', () => {
    const markup = render(failedReport, [{ status: 'ready', types: ['task'] }]);

    expect(markup).toMatch(
      /<\/ul><button class="btn primary" type="button">Start onboarding<\/button><\/section>/,
    );
  });

  it('should render no button when an onboard ticket is open', () => {
    const markup = render(failedReport, [{ status: 'in-progress', types: ['onboard'] }]);

    expect(markup).not.toContain('<button');
  });

  it('should render no button when the board has not loaded', () => {
    const markup = render(failedReport, undefined);

    expect(markup).not.toContain('<button');
  });
});

describe('StartOnboardingView', () => {
  it('should render an aria-disabled Starting… button with the info dot when busy', () => {
    expect(renderAction({ isBusy: true })).toBe(
      '<button class="btn" type="button" aria-disabled="true"><span class="shape s-flow" aria-hidden="true">●</span>Starting…</button>',
    );
  });

  it('should render a warn alert with the square mark after the default button when the error is warn', () => {
    const markup = renderAction({
      isBusy: false,
      error: { tone: 'warn', message: 'Onboarding already started or done.' },
    });

    expect(markup).toMatch(
      /^<button class="btn primary" type="button">Start onboarding<\/button><div class="err warn" role="alert"><span class="shape" aria-hidden="true">■<\/span><p>Onboarding already started or done.<\/p><\/div>$/,
    );
  });

  it('should render a danger alert with the detail as small mono text when the error is danger', () => {
    const markup = renderAction({
      isBusy: false,
      error: { tone: 'danger', message: 'Failed.', detail: 'Project o/n is not registered' },
    });

    expect(markup).toContain(
      '<div class="err" role="alert"><span class="shape" aria-hidden="true">■</span><p>Failed.</p><p class="sm mono">Project o/n is not registered</p></div>',
    );
  });
});
