import { describe, expect, it } from 'vitest';
import { buildCheckpointResumePrompt } from '../../../../../../src/modules/runner/logic/domain/functions/build-checkpoint-resume-prompt.js';

describe('buildCheckpointResumePrompt', () => {
  it('should carry on with the given skill when the run is a spike', () => {
    const prompt = buildCheckpointResumePrompt(42, 'Check', 'Fine', 'aisf:spike');

    expect(prompt).toContain('Carry on with aisf:spike for #42 from its human checkpoint.');
  });

  it('should return the exact prompt text when request and answer are single lines', () => {
    const prompt = buildCheckpointResumePrompt(
      228,
      'Open the board',
      'Looks right',
      'aisf:implement-ticket',
    );

    expect(prompt).toBe(
      [
        'Your call for a human at #228 was delivered, and a human has answered it.',
        'The tool result that says the call was interrupted is how the app pauses a run, not a failure. Do not verify or retry that call, and do not call it again for this request.',
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

  it('should name no tool when it builds the prompt', () => {
    const prompt = buildCheckpointResumePrompt(228, 'Check the page', 'Looks good', 'aisf:spike');

    expect(prompt).not.toContain('aisf_');
    expect(prompt).toContain('> Check the page');
    expect(prompt).toContain('> Looks good');
  });

  it('should quote every line, empty ones included, when request and answer span lines', () => {
    const prompt = buildCheckpointResumePrompt(
      228,
      'Run the app\n\nOpen the board',
      'It failed:\nno chip',
      'aisf:implement-ticket',
    );

    expect(prompt).toContain('Your request:\n> Run the app\n> \n> Open the board\n\n');
    expect(prompt).toContain("The human's answer:\n> It failed:\n> no chip\n\n");
  });
});
