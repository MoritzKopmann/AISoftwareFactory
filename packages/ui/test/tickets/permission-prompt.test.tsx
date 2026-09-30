import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PermissionPromptDescription } from '../../src/tickets/describe-permission-prompt.js';
import { PermissionPrompt } from '../../src/tickets/permission-prompt.js';

const ignoreAnswer = () => undefined;

const prompt: PermissionPromptDescription = {
  kind: 'shown',
  runId: 'run-1',
  toolName: 'Bash',
  inputText: 'pnpm add zod',
  guidance: true,
  pressable: true,
};

function render(description: PermissionPromptDescription): string {
  return renderToStaticMarkup(
    <PermissionPrompt description={description} onAnswer={ignoreAnswer} />,
  );
}

describe('PermissionPrompt', () => {
  it('should render nothing when the prompt is hidden', () => {
    expect(render({ kind: 'hidden' })).toBe('');
  });

  it('should label the section by its heading and show the tool, input and guidance when waiting', () => {
    const markup = render(prompt);
    const labelledBy = /<section[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelledBy).toBeDefined();
    expect(markup).toContain(`id="${labelledBy}">Waiting for your permission<`);
    expect(markup).toContain('>Bash<');
    expect(markup).toContain('>pnpm add zod</pre>');
    expect(markup).toContain('Your answer resumes the same session.');
    expect(markup).toContain('Allow lets this exact call run once.');
    expect(markup).not.toContain('aria-disabled');
  });

  it('should disable both buttons, show Resuming… on the pressed one and announce it when resuming', () => {
    const markup = render({
      ...prompt,
      guidance: false,
      pressable: false,
      resuming: 'deny',
      announcement: 'Resuming the run',
    });
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(markup).toMatch(/>Allow<\/button>/);
    expect(markup).toMatch(/Resuming…<\/button>/);
    expect(markup).not.toMatch(/>Deny<\/button>/);
    expect(markup).toMatch(/role="status"[^>]*>Resuming the run</);
    expect(markup).not.toContain('Your answer resumes the same session.');
    expect(markup).not.toContain('Allow lets this exact call run once.');
  });

  it('should announce a failed answer through an alert placed before the buttons', () => {
    const markup = render({
      ...prompt,
      guidance: false,
      error: { message: "Couldn't send your answer. Gone.", detail: '409' },
    });
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('>409<');
    expect(markup.indexOf('role="alert"')).toBeLessThan(markup.indexOf('>Allow<'));
  });
});
