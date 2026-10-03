import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TicketBodyMarkdown } from '../../src/tickets/ticket-body-markdown.js';

function render(source: string): string {
  return renderToStaticMarkup(<TicketBodyMarkdown source={source} />);
}

describe('TicketBodyMarkdown', () => {
  it('should wrap the content in the scoped ticket-markdown class when rendering', () => {
    expect(render('hello')).toMatch(/^<div class="ticket-markdown">/);
  });

  it('should render headings, lists, quote, rule and details as elements when the source uses them', () => {
    const markup = render(
      '# One\n\n## Two\n\n### Three\n\n- a\n\n1. b\n\n> q\n\n---\n\n<details><summary>S</summary>body</details>',
    );
    expect(markup).toContain('<h1 id="one">One</h1>');
    expect(markup).toContain('<h2 id="two">Two</h2>');
    expect(markup).toContain('<h3 id="three">Three</h3>');
    expect(markup).toContain('<ul><li>a</li></ul>');
    expect(markup).toContain('<ol start="1"><li>b</li></ol>');
    expect(markup).toContain('<blockquote><p>q</p></blockquote>');
    expect(markup).toContain('<hr/>');
    expect(markup).toContain('<details><summary>S</summary>body</details>');
  });

  it('should render a code block as pre and code when the source has a fence', () => {
    expect(render('```js\nx\n```')).toMatch(/<pre><code class="[^"]*">x<\/code><\/pre>/);
  });

  it('should render every task-list checkbox disabled when the source has a task list', () => {
    const markup = render('- [ ] todo\n- [x] done');
    const boxes = markup.match(/<input[^>]*>/g) ?? [];
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box).toContain('disabled=""');
    }
    expect(boxes[1]).toContain('checked=""');
  });

  it('should render an https link opening in a new tab with noopener noreferrer when the target is https', () => {
    const markup = render('[a](https://example.com/x)');
    expect(markup).toContain(
      '<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">a</a>',
    );
  });

  it('should render an http link opening in a new tab when the target is http', () => {
    expect(render('[a](http://example.com)')).toContain('target="_blank"');
  });

  it.each([
    '#section',
    'javascript:alert(1)',
    'mailto:a@b.c',
    'rel/path',
    '/abs',
    'data:text/html,x',
  ])('should render the text without a link when the target is %s', (target) => {
    const markup = render(`[label](${target})`);
    expect(markup).not.toContain('<a');
    expect(markup).not.toContain('href');
    expect(markup).toContain('label');
  });

  it('should show a script tag as text and emit no script element when the source holds one', () => {
    const markup = render('<script>alert(1)</script>');
    expect(markup).not.toContain('<script');
    expect(markup).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('should drop an onclick attribute when raw html carries one', () => {
    const markup = render('<p onclick="x()">hi</p>');
    expect(markup).not.toContain('onclick');
    expect(markup).toContain('hi');
  });

  it('should show iframe and style tags as text when the source holds them', () => {
    const markup = render('<iframe src="https://x"></iframe>\n\n<style>a{}</style>');
    expect(markup).not.toContain('<iframe');
    expect(markup).not.toContain('<style');
  });

  it('should drop a javascript target when raw html carries one', () => {
    expect(render('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
  });

  it('should wrap a table in a sideways-scrolling box when the source has a table', () => {
    const markup = render('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(markup).toMatch(/<div class="ticket-markdown-table"><table>.*<\/table><\/div>/);
  });

  it('should render a picture as a plain img when the source has an image', () => {
    expect(render('![alt](https://x.test/y.png)')).toContain(
      '<img alt="alt" src="https://x.test/y.png"/>',
    );
  });

  it('should render the whole body when it is 65,536 characters long', () => {
    const body = `${'a'.repeat(65_530)}\n\nEND-OK`;
    const markup = render(body);
    expect(body.length).toBeGreaterThanOrEqual(65_536);
    expect(markup).toContain('END-OK');
    expect(markup).toContain('a'.repeat(65_530));
  });
});
