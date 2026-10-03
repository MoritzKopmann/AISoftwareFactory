import { describe, expect, it } from 'vitest';
import { buildCheckpointResumePrompt } from '../../../../../../src/modules/runner/logic/domain/functions/build-checkpoint-resume-prompt.js';

describe('buildCheckpointResumePrompt', () => {
  it('should return the exact prompt text when request and answer are single lines', () => {
    const prompt = buildCheckpointResumePrompt(228, 'Open the board', 'Looks right');

    expect(prompt).toBe(
      [
        'Your aisf_checkpoint call for #228 was delivered, and a human has answered it.',
        'The tool result that says the call was interrupted is how the app pauses a run at its checkpoint, not a failure. Do not verify or retry that call, and do not call aisf_checkpoint again for this request.',
        '',
        'Your request:',
        '> Open the board',
        '',
        "The human's answer:",
        '> Looks right',
        '',
        'Carry on with aisf:implement-ticket for #228 from its human checkpoint.',
      ].join('\n'),
    );
  });

  it('should quote every line, empty ones included, when request and answer span lines', () => {
    const prompt = buildCheckpointResumePrompt(
      228,
      'Run the app\n\nOpen the board',
      'It failed:\nno chip',
    );

    expect(prompt).toContain('Your request:\n> Run the app\n> \n> Open the board\n\n');
    expect(prompt).toContain("The human's answer:\n> It failed:\n> no chip\n\n");
  });
});
