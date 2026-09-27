import type { ContractPreflightReportResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { describeContractReport } from './describe-contract-report.js';

type ContractReportProps = {
  readonly report: ContractPreflightReportResponse;
};

export function ContractReport({ report }: ContractReportProps) {
  const description = describeContractReport(report);

  return (
    <section role={report.passed ? 'status' : 'alert'}>
      <h3>{description.headline}</h3>
      {description.missingItems.length > 0 && (
        <ul>
          {description.missingItems.map((item) => (
            <li key={item} className="mono">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
