/** The round the board's feedback went out in, read from the page's saved draft. Undefined when none. */
export function readSentBoardRound(draft: string | undefined): number | undefined {
  if (draft === undefined) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(draft);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return undefined;
  }
  const board = isRecord(parsed) ? parsed['board'] : undefined;
  const sentRound = isRecord(board) ? board['sentRound'] : undefined;
  return typeof sentRound === 'number' ? sentRound : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
