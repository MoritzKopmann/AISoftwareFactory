export type SecondaryStates = {
  readonly waiting: boolean;
  readonly stuck: boolean;
};

export function deriveSecondaryStates(issue: {
  readonly labelNames: ReadonlyArray<string>;
}): SecondaryStates {
  return {
    waiting: issue.labelNames.includes('waiting'),
    stuck: issue.labelNames.includes('stuck'),
  };
}
