import type { AisfLabel } from './aisf-labels.js';

export function findMissingLabels(
  aisfLabels: ReadonlyArray<AisfLabel>,
  existingLabelNames: ReadonlyArray<string>,
): ReadonlyArray<AisfLabel> {
  const existingLabelNamesLowerCase = new Set(existingLabelNames.map((name) => name.toLowerCase()));
  return aisfLabels.filter((label) => !existingLabelNamesLowerCase.has(label.name.toLowerCase()));
}
