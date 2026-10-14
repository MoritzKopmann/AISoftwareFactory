export type ContractPreflightReport = {
  readonly passed: boolean;
  readonly missingSlots: ReadonlyArray<string>;
  readonly missingKeys: ReadonlyArray<string>;
};
