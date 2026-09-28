export type ContractPreflightReport = {
  readonly passed: boolean;
  readonly missingSlots: ReadonlyArray<string>;
  readonly missingHeadings: ReadonlyArray<{ readonly slot: string; readonly heading: string }>;
  readonly missingKeys: ReadonlyArray<string>;
};
