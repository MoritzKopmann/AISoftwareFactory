export function decideRoundAfterFeedback(
  round: number | undefined,
  sentRound: number | undefined,
): number | undefined {
  if (round === undefined || sentRound === undefined || round > sentRound) {
    return undefined;
  }
  return sentRound + 1;
}
