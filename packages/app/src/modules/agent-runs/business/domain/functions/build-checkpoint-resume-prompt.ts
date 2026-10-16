function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

// The CLI's interrupted-tool result says "verify … retry", so the prompt must say it was delivered.
export function buildCheckpointResumePrompt(
  ticketNumber: number,
  request: string,
  answerText: string,
  skill: string,
): string {
  return [
    `Your call for a human at #${ticketNumber} was delivered, and a human has answered it.`,
    'The tool result that says the call was interrupted is how the app pauses a run, not a failure. Do not verify or retry that call, and do not call it again for this request.',
    '',
    'Your request:',
    quote(request),
    '',
    "The human's answer:",
    quote(answerText),
    '',
    `Carry on with ${skill} for #${ticketNumber} from its human checkpoint.`,
  ].join('\n');
}
