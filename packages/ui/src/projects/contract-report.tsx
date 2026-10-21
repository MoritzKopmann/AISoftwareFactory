import { useState } from 'react';
import type { ContractPreflightReportResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import type { TicketResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describeContractReport } from './describe-contract-report.js';
import { describeOnboardingAction } from './describe-onboarding-action.js';
import {
  describeStartOnboarding,
  type OnboardingStart,
  type StartOnboardingDescription,
} from './describe-start-onboarding.js';
import { pressStartOnboarding } from './press-start-onboarding.js';

type ContractReportProps = {
  readonly report: ContractPreflightReportResponse;
  readonly projectId: string;
  readonly tickets: ReadonlyArray<Pick<TicketResponse, 'status' | 'types'>> | undefined;
};

export function ContractReport({ report, projectId, tickets }: ContractReportProps) {
  if (report.passed) {
    return null;
  }
  const description = describeContractReport(report);

  return (
    <section className="panel" role="alert">
      <span>
        <span className="shape s-warn" aria-hidden="true">
          ▲
        </span>{' '}
        <b>{description.headline}</b>
      </span>
      {description.missingItems.length > 0 && (
        <ul>
          {description.missingItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {showsOnboardingAction(report, tickets) && <StartOnboardingAction projectId={projectId} />}
    </section>
  );
}

function showsOnboardingAction(
  report: ContractPreflightReportResponse,
  tickets: ContractReportProps['tickets'],
): boolean {
  return tickets !== undefined && describeOnboardingAction(report, tickets).kind === 'shown';
}

function StartOnboardingAction({ projectId }: { readonly projectId: string }) {
  const [start, setStart] = useState<OnboardingStart>({ kind: 'idle' });

  const press = () =>
    void pressStartOnboarding(start, projectId, {
      request: (url, requestInit) => fetch(url, requestInit),
      setStart,
      navigate: (hash) => {
        window.location.hash = hash;
      },
    });

  return <StartOnboardingView description={describeStartOnboarding(start)} onPress={press} />;
}

export function StartOnboardingView({
  description,
  onPress,
}: {
  readonly description: StartOnboardingDescription;
  readonly onPress: () => void;
}) {
  const { isBusy, error } = description;
  return (
    <>
      <button
        className={isBusy ? 'btn' : 'btn primary'}
        type="button"
        aria-disabled={isBusy ? 'true' : undefined}
        onClick={onPress}
      >
        {isBusy ? (
          <>
            <span className="shape s-flow" aria-hidden="true">
              ●
            </span>
            Starting…
          </>
        ) : (
          'Start onboarding'
        )}
      </button>
      {error !== undefined && (
        <div className={error.tone === 'warn' ? 'err warn' : 'err'} role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{error.message}</p>
          {error.detail !== undefined && <p className="sm mono">{error.detail}</p>}
        </div>
      )}
    </>
  );
}
