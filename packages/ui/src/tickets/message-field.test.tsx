import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MessageField, type MessageFieldProps } from './message-field.js';

const ignore = () => undefined;

function aField(overrides: Partial<MessageFieldProps> = {}): MessageFieldProps {
  return {
    draft: '',
    pressable: false,
    sending: false,
    noActiveRun: false,
    onDraftChange: ignore,
    onSend: ignore,
    ...overrides,
  };
}

function render(overrides: Partial<MessageFieldProps> = {}): string {
  return renderToStaticMarkup(<MessageField {...aField(overrides)} />);
}

type ElementProps = {
  children?: ReactNode;
  onClick?: (event: { preventDefault: () => void }) => void;
  onChange?: (event: { target: { value: string } }) => void;
  onSubmit?: (event: { preventDefault: () => void }) => void;
};

function findProps(node: ReactNode, type: string): ElementProps | undefined {
  if (Array.isArray(node)) {
    for (const child of node as ReactNode[]) {
      const found = findProps(child, type);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement<ElementProps>(node)) return undefined;
  if (node.type === type) return node.props;
  return findProps(node.props.children, type);
}

const click = { preventDefault: ignore };

describe('MessageField', () => {
  it('should render a form with a hidden label and a placeholder when the run is active', () => {
    const markup = render();

    expect(markup).toMatch(/^<form class="mf"/);
    expect(markup).toMatch(/<label class="vh"[^>]*>Message to the agent<\/label>/);
    expect(markup).toContain('placeholder="Message the agent"');
    expect(markup).toContain('maxLength="10000"');
  });

  it('should show an inactive Send and the zero counter when the field is empty', () => {
    const markup = render();

    expect(markup).toMatch(/<button class="btn primary"[^>]*aria-disabled="true"[^>]*>Send</);
    expect(markup).toContain('0 / 10 000');
    expect(markup).toContain('The agent reads it at its next step. The run goes on.');
  });

  it('should link the hint to the textarea when rendered', () => {
    const markup = render();
    const hintId = /aria-describedby="([^"]+)"/.exec(markup)?.[1];

    expect(hintId).toBeDefined();
    expect(markup).toContain(`id="${hintId}"`);
  });

  it('should count the draft in grouped thousands when text is typed', () => {
    const markup = render({ draft: 'a'.repeat(1234), pressable: true });

    expect(markup).toContain('1 234 / 10 000');
    expect(markup).not.toContain('aria-disabled');
  });

  it('should call onSend when an active Send is pressed', () => {
    const onSend = vi.fn();

    findProps(MessageField(aField({ pressable: true, onSend })), 'button')?.onClick?.(click);

    expect(onSend).toHaveBeenCalledOnce();
  });

  it('should not call onSend when an inactive Send is pressed', () => {
    const onSend = vi.fn();

    findProps(MessageField(aField({ onSend })), 'button')?.onClick?.(click);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('should call onDraftChange with the text when the textarea changes', () => {
    const onDraftChange = vi.fn();

    findProps(MessageField(aField({ onDraftChange })), 'textarea')?.onChange?.({
      target: { value: 'Hi' },
    });

    expect(onDraftChange).toHaveBeenCalledExactlyOnceWith('Hi');
  });

  it('should make the textarea read-only and announce it when sending', () => {
    const markup = render({ draft: 'Hi', sending: true });

    expect(markup).toMatch(/<textarea[^>]*readOnly=""/);
    expect(markup).toMatch(
      /aria-disabled="true"[^>]*><span class="shape pulse"[^>]*>●<\/span>Sending…/,
    );
    expect(markup).toMatch(/role="status"[^>]*>Sending your message</);
  });

  it('should show the error with the message and the status code when sending failed', () => {
    const markup = render({
      draft: 'Hi',
      pressable: true,
      error: { message: '#147 is not running', status: '409' },
    });

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Couldn&#x27;t send your message. #147 is not running');
    expect(markup).toMatch(/<p class="sm mono">409<\/p>/);
    expect(markup).toContain('>Hi</textarea>');
    expect(markup.indexOf('role="alert"')).toBeLessThan(markup.indexOf('<textarea'));
  });

  it('should show no code when the network failed', () => {
    const markup = render({ error: { message: "Can't reach aisf." } });

    expect(markup).toContain('Couldn&#x27;t send your message. Can&#x27;t reach aisf.');
    expect(markup).not.toContain('sm mono');
  });

  it('should show the held line above the field when the message is held', () => {
    const markup = render({ held: { heldUntilLabel: '15:00' } });

    expect(markup).toContain('Your message is held. It goes out at <strong>15:00</strong>.');
    expect(markup.indexOf('held-status')).toBeLessThan(markup.indexOf('<textarea'));
    expect(markup).not.toMatch(/<textarea[^>]*(disabled|readOnly)/);
  });

  it('should disable the textarea and swap the copy when there is no active run', () => {
    const markup = render({ noActiveRun: true });

    expect(markup).toMatch(/<textarea[^>]*disabled=""/);
    expect(markup).toContain('placeholder="No active run"');
    expect(markup).toContain('No active run. Messages go to a running agent.');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toContain('class="count');
  });

  it('should mark the textarea, hint and counter when the draft is at the limit', () => {
    const markup = render({ draft: 'a'.repeat(10_000), pressable: true });

    expect(markup).toMatch(/<textarea[^>]*class="over"/);
    expect(markup).toContain('Limit reached. Shorten the message to add more.');
    expect(markup).toContain('<span class="count at">10 000 / 10 000</span>');
  });

  it('should not mark the limit when the draft is one short of it', () => {
    const markup = render({ draft: 'a'.repeat(9999) });

    expect(markup).not.toContain('over');
    expect(markup).toContain('<span class="count">9 999 / 10 000</span>');
  });
});
