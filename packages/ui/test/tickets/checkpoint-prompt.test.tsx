import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CheckpointPrompt } from '../../src/tickets/checkpoint-prompt.js';
import type { CheckpointPromptDescription } from '../../src/tickets/describe-checkpoint-prompt.js';

const ignore = () => undefined;

const prompt: CheckpointPromptDescription = {
  kind: 'shown',
  runId: 'run-1',
  request: 'Include <b>archived</b> runs?',
  draft: 'B.',
  counterText: '2 / 10 000',
  hint: 'Plain text. Up to 10 000 characters.',
  atLimit: false,
  sending: false,
  pressable: true,
};

function render(description: CheckpointPromptDescription): string {
  return renderToStaticMarkup(
    <CheckpointPrompt description={description} onDraftChange={ignore} onSend={ignore} />,
  );
}

describe('CheckpointPrompt', () => {
  it('should render nothing when the prompt is hidden', () => {
    expect(render({ kind: 'hidden' })).toBe('');
  });

  it('should label the section by its heading and show the request as plain text and the answer field when ready', () => {
    const markup = render(prompt);
    const labelledBy = /<section[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelledBy).toBeDefined();
    expect(markup).toContain(`id="${labelledBy}">Waiting for your answer<`);
    expect(markup).toContain('Your answer resumes the same session.');
    expect(markup).toContain('>Include &lt;b&gt;archived&lt;/b&gt; runs?</pre>');
    const answerId = /<textarea[^>]*id="([^"]+)"/.exec(markup)?.[1];
    expect(answerId).toBeDefined();
    expect(markup).toContain(`for="${answerId}">Your answer</label>`);
    expect(markup).toMatch(/<textarea[^>]*maxLength="10000"[^>]*>B\.<\/textarea>/);
    expect(markup).toContain('>Plain text. Up to 10 000 characters.<');
    expect(markup).toContain('>2 / 10 000<');
    expect(markup).toMatch(/>Send<\/button>/);
    expect(markup).not.toContain('aria-disabled');
    expect(markup).not.toContain('readOnly');
  });

  it('should hold Send and show the reason when Send is not pressable', () => {
    const markup = render({ ...prompt, pressable: false, reason: 'Write an answer to send it.' });
    expect(markup).toMatch(/aria-disabled="true"[^>]*>Send<\/button>/);
    expect(markup).toContain('>Write an answer to send it.<');
  });

  it('should make the field read-only, show Resuming… on Send and announce it when sending', () => {
    const markup = render({
      ...prompt,
      sending: true,
      pressable: false,
      announcement: 'Sending your answer',
    });
    expect(markup).toMatch(/<textarea[^>]*readOnly=""/);
    expect(markup).toMatch(/aria-disabled="true"[^>]*>.*Resuming…<\/button>/);
    expect(markup).toMatch(/role="status"[^>]*>Sending your answer</);
  });

  it('should announce the error through an alert placed before Send when the send failed', () => {
    const markup = render({
      ...prompt,
      error: { message: "Couldn't send your answer. Gone.", detail: '409' },
    });
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('>Couldn&#x27;t send your answer. Gone.<');
    expect(markup).toContain('>409<');
    expect(markup.indexOf('role="alert"')).toBeLessThan(markup.indexOf('>Send<'));
  });

  it('should tell the limit is reached when the answer is at the limit', () => {
    const markup = render({
      ...prompt,
      counterText: '10 000 / 10 000',
      atLimit: true,
      hint: 'Limit reached. Shorten the answer to add more.',
    });
    expect(markup).toContain('>Limit reached. Shorten the answer to add more.<');
    expect(markup).not.toContain('Plain text. Up to 10 000 characters.');
  });
});
