import type { ContractPreflightReportResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { describeContractReport } from './describe-contract-report.js';

type ContractReportProps = {
  readonly report: ContractPreflightReportResponse;
};

export function ContractReport({ report }: ContractReportProps) {
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
    </section>
  );
}
