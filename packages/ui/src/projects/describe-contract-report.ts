import type { ContractPreflightReportResponse } from '@aisf/app/api-schemas/projects-schemas.js';

export type ContractReportDescription = {
  readonly headline: string;
  readonly missingItems: ReadonlyArray<string>;
};

export function describeContractReport(
  report: ContractPreflightReportResponse,
): ContractReportDescription {
  if (report.passed) {
    return { headline: 'Contract pre-flight passed', missingItems: [] };
  }

  const missingItems = [
    ...report.missingSlots,
    ...report.missingHeadings.map((missing) => `${missing.slot}: ${missing.heading}`),
    ...report.missingKeys,
  ];

  return {
    headline: `Contract pre-flight: ${missingItems.length} part${missingItems.length === 1 ? '' : 's'} missing`,
    missingItems,
  };
}
