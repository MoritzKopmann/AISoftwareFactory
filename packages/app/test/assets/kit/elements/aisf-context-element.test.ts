// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, $$, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfContextElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should show the path and mark the line when a code context has path and line', async () => {
    await mount(
      '<aisf-context kind="code" path="src/a.ts" line="3">one\ntwo\nthree\nfour\nfive</aisf-context>',
    );

    const lines = $$('.aisf-code-line');
    expect($('.aisf-context-path').textContent).toBe('src/a.ts');
    expect(lines).toHaveLength(5);
    expect(lines.map((line) => line.classList.contains('aisf-code-line-marked'))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(lines[2]?.textContent).toBe('three');
  });

  it('should show code as text when the excerpt holds markup', async () => {
    await mount('<aisf-context kind="code" path="a.html">&lt;b&gt;x&lt;/b&gt;</aisf-context>');

    expect($('.aisf-code-line').textContent).toBe('<b>x</b>');
    expect(document.querySelector('.aisf-code-line-marked')).toBeNull();
  });

  it('should keep the content as written when the kind is mockup or diagram', async () => {
    await mount('<aisf-context kind="mockup"><button id="m">Go</button></aisf-context>');

    expect($('#m').textContent).toBe('Go');
    expect($('.aisf-context-kind').textContent).toBe('mockup');
  });

  it('should not build the code lines twice when the element moves', async () => {
    await mount(
      '<aisf-context kind="code" path="a.ts" line="1">x\ny</aisf-context><div id="to"></div>',
    );

    $('#to').append($('aisf-context'));

    expect($$('.aisf-code-line')).toHaveLength(2);
  });
});
