import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NewIdeaFormDescription } from './describe-new-idea-form.js';
import { NewIdeaFormView } from './new-idea-form.js';

function render(text: string, description: NewIdeaFormDescription): string {
  return renderToStaticMarkup(
    <NewIdeaFormView
      text={text}
      description={description}
      onTextChange={() => undefined}
      onSubmit={() => undefined}
    />,
  );
}

describe('NewIdeaFormView', () => {
  it('should render a 3-row textarea with the placeholder and the hint when idle', () => {
    const markup = render('', { pressable: false, busy: false });

    expect(markup).toMatch(
      /<textarea[^>]*rows="3"[^>]*placeholder="What should exist\? Add as much detail as you like\."/,
    );
    expect(markup).toContain('The first line becomes the title.');
  });

  it('should render a primary + New idea button when idle', () => {
    expect(render('', { pressable: false, busy: false })).toMatch(
      /<button class="btn primary" type="submit">\+ New idea<\/button>/,
    );
  });

  it('should mark the form busy and the textarea read-only when busy', () => {
    const markup = render('Export', { pressable: false, busy: true });

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toMatch(/<textarea[^>]*readOnly=""/);
  });

  it('should render an aria-disabled Creating… button with the info dot when busy', () => {
    expect(render('Export', { pressable: false, busy: true })).toMatch(
      /<button class="btn" type="submit" aria-disabled="true"><span class="shape s-flow"[^>]*>●<\/span>Creating…<\/button>/,
    );
  });

  it('should render a danger alert with the message and the detail when the error is danger', () => {
    const markup = render('Export', {
      pressable: true,
      busy: false,
      error: { tone: 'danger', message: "Couldn't create the idea.", detail: 'POST /ideas · 502' },
    });

    expect(markup).toMatch(/<div class="err" role="alert"><span class="shape s-danger"[^>]*>■/);
    expect(markup).toContain('Couldn&#x27;t create the idea.');
    expect(markup).toContain('POST /ideas · 502');
  });

  it('should render a warn alert with the link when the error is warn', () => {
    const markup = render('', {
      pressable: false,
      busy: false,
      error: {
        tone: 'warn',
        message: 'The idea was created, but the session did not start.',
        link: { label: 'Open #419', href: '#/projects/o/n/tickets/419' },
      },
    });

    expect(markup).toMatch(/<div class="err warn" role="alert"><span class="shape s-warn"[^>]*>▲/);
    expect(markup).toContain('<a href="#/projects/o/n/tickets/419">Open #419</a>');
  });

  it('should render no alert when there is no error', () => {
    expect(render('Export', { pressable: true, busy: false })).not.toContain('role="alert"');
  });
});
