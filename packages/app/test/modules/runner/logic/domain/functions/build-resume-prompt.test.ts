import { describe, expect, it } from 'vitest';
import { buildResumePrompt } from '../../../../../../src/modules/runner/logic/domain/functions/build-resume-prompt.js';

const toolCall = { toolName: 'Bash', toolInput: { command: 'git config spike.resume 1' } };

describe('buildResumePrompt', () => {
  it('should name the call and say the human allowed it when the decision is allow', () => {
    const prompt = buildResumePrompt(toolCall, 'allow');

    expect(prompt).toContain('allowed');
    expect(prompt).toContain('Bash');
    expect(prompt).toContain('{"command":"git config spike.resume 1"}');
    expect(prompt).toContain('again');
  });

  it('should name the call and say the human refused it when the decision is deny', () => {
    const prompt = buildResumePrompt(toolCall, 'deny');

    expect(prompt).toContain('refused');
    expect(prompt).toContain('Bash');
    expect(prompt).toContain('{"command":"git config spike.resume 1"}');
    expect(prompt).toContain('without it');
  });
});
