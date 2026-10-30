// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { mockPlayback } from '../fixtures/playback-mock.js';
import { $, $$, click, mount, settle, startPage } from '../fakes/fake-aisf.js';

/** SVG elements have no `click()`: send the event a browser would. */
async function clickSvg(element: Element): Promise<void> {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await settle();
}

type Fn = {
  id: string;
  sig: string;
  mark: string;
  does: string;
  source?: string;
  pending?: string;
};

function data(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    modules: [{ id: 'm', mark: 'changed', tag: 'changed' }],
    screens: [],
    classes: [
      {
        id: 'useCase',
        module: 'm',
        layer: 'business',
        file: 'use-case.ts',
        name: 'UseCase',
        kind: 'use case',
        mark: 'changed',
        fns: [
          { id: 'execute', sig: 'execute(id)', mark: 'new', does: 'Runs it.' },
          {
            id: 'retry',
            sig: 'retry(id)',
            mark: 'changed',
            does: 'Tries again.',
            source: 'src/a.ts',
          },
        ],
      },
    ],
    criteria: {
      AC1: {
        title: 'first',
        paths: [
          {
            actor: 'owner',
            steps: [
              [null, 'useCase.execute', 'POST /go', 'entry'],
              ['useCase.execute', 'useCase.retry', 'retry(id)'],
            ],
            end: ['useCase.retry', 'done'],
          },
        ],
      },
      AC2: {
        title: 'second',
        paths: [
          {
            actor: 'owner',
            steps: [
              [null, 'useCase.execute', 'POST /go', 'entry'],
              ['useCase.execute', 'useCase.retry', 'retry(id)'],
              ['useCase.retry', 'useCase.execute', 'back'],
            ],
            end: ['useCase.execute', 'again'],
          },
        ],
      },
    },
    ...overrides,
  };
}

function playback(value: unknown): string {
  const json = typeof value === 'string' ? value : JSON.stringify(value).replaceAll('<', '\\u003c');
  return `<aisf-playback><script type="application/json">${json}</script></aisf-playback>`;
}

function withFns(fns: Fn[], mark = 'new'): Record<string, unknown> {
  const base = data() as { classes: Array<Record<string, unknown>> };
  return data({ classes: [{ ...base.classes[0], mark, fns }] });
}

describe('AisfPlaybackElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should draw one box with a block per function when mounted', async () => {
    await mount(playback(data()));

    const box = $<SVGElement>('aisf-playback svg [data-class="useCase"]');
    const execute = $('[data-fn="useCase.execute"]', box);
    const retry = $('[data-fn="useCase.retry"]', box);
    expect($$('[data-class="useCase"]')).toHaveLength(1);
    expect(execute.textContent).toContain('execute(id)');
    expect(execute.textContent).toContain('Runs it.');
    expect(retry.textContent).toContain('retry(id)');
    expect(retry.textContent).toContain('Tries again.');
  });

  it.each(['new', 'changed', 'untouched', 'removed'])(
    'should give the block rect the %s mark class when a function has that mark',
    async (mark) => {
      await mount(playback(withFns([{ id: 'execute', sig: 'execute(id)', mark, does: 'Runs.' }])));

      const rect = $('[data-fn="useCase.execute"] rect');

      expect(rect.classList.contains(`aisf-shape-${mark}`)).toBe(true);
    },
  );

  it('should draw a separator line in each gap when a class has three functions', async () => {
    const fns = ['a', 'b', 'c'].map((id) => ({ id, sig: `${id}()`, mark: 'new', does: 'Does.' }));
    await mount(playback(withFns(fns)));

    const box = $('aisf-playback svg [data-class="useCase"]');
    const lines = $$('line.aisf-pb-block-sep', box);
    const rects = ['a', 'b', 'c'].map((id) => $('[data-fn="useCase.' + id + '"] rect', box));
    const num = (element: Element, name: string) => Number(element.getAttribute(name));

    expect(lines).toHaveLength(2);
    lines.forEach((line, index) => {
      const above = rects[index] as Element;
      const below = rects[index + 1] as Element;
      const mid = (num(above, 'y') + num(above, 'height') + num(below, 'y')) / 2;
      expect(num(line, 'y1')).toBe(mid);
      expect(num(line, 'y2')).toBe(mid);
      expect(num(line, 'x1')).toBe(num(above, 'x'));
      expect(num(line, 'x2')).toBe(num(above, 'x') + num(above, 'width'));
    });
  });

  it('should draw no separator line when a class has one function', async () => {
    await mount(playback(withFns([{ id: 'a', sig: 'a()', mark: 'new', does: 'Does.' }])));

    expect($$('line.aisf-pb-block-sep')).toHaveLength(0);
  });

  it('should show one key chip per mark and no node class when mounted', async () => {
    await mount(playback(data()));

    const chips = $$('.aisf-pb-key > span');

    expect(chips.map((chip) => chip.className)).toEqual([
      'aisf-pb-key-new',
      'aisf-pb-key-changed',
      'aisf-pb-key-unchanged',
      'aisf-pb-key-removed',
    ]);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'new',
      'changed',
      'unchanged',
      'removed',
    ]);
  });

  it('should read the specimen from its own JSON child and no other script when read', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../../../../assets/kit/specimens.html'),
      'utf8',
    );

    const start = source.indexOf('<aisf-playback>');
    const element = source.slice(start, source.indexOf('</aisf-playback>', start));

    expect(element).toContain('<script type="application/json">');
    expect(element.match(/<script/g)).toHaveLength(1);
  });

  it('should draw only the selected criterion when its switch is clicked', async () => {
    await mount(playback(data()));

    await click($('.aisf-switch[data-key="AC2"]'));
    const second = $$('.aisf-pb-wire');
    await click($('.aisf-switch[data-key="All"]'));
    const all = $$('.aisf-pb-wire');

    expect(second).toHaveLength(3);
    expect(second.every((wire) => wire.getAttribute('data-criterion') === 'AC2')).toBe(true);
    expect(all).toHaveLength(5);
  });

  it('should letter two paths A and B when a criterion has two starting points', async () => {
    const twin = data({
      criteria: {
        AC1: {
          title: 'two',
          paths: [
            {
              actor: 'owner',
              label: 'profile toggle',
              steps: [[null, 'useCase.execute', 'click', 'entry']],
              end: ['useCase.execute', 'saved'],
            },
            {
              actor: 'GitHub',
              steps: [
                [null, 'useCase.retry', 'webhook', 'entry'],
                ['useCase.retry', 'useCase.execute', 'back'],
              ],
              end: ['useCase.execute', 'sent'],
            },
          ],
        },
      },
    });
    await mount(playback(twin));

    const badges = $$('.aisf-pb-step .aisf-pb-badge').map((badge) => badge.textContent);
    const heads = $$('.aisf-pb-route-head .aisf-pb-route-path').map((head) => head.textContent);
    const runs = $$('.aisf-pb-wire[data-run="B"]');

    expect(badges).toEqual(['A1', 'B1', 'B2']);
    expect(heads).toEqual(['Path A', 'Path B']);
    expect(runs).toHaveLength(2);
  });

  it('should flag a block when its fn is not new and names no source', async () => {
    await mount(
      playback(withFns([{ id: 'execute', sig: 'execute()', mark: 'changed', does: 'x' }])),
    );

    const block = $<SVGElement>('[data-fn="useCase.execute"]');

    expect(block.getAttribute('class')).toContain('aisf-shape-flagged');
    expect(block.querySelector('title')?.textContent).toContain('source');
  });

  it('should show long text in full and unflagged when a new fn has 140 characters', async () => {
    const long = 'word '.repeat(28).trim();
    await mount(playback(withFns([{ id: 'execute', sig: 'execute()', mark: 'new', does: long }])));

    const block = $<SVGElement>('[data-fn="useCase.execute"]');
    const shown = $$('.aisf-pb-does', block)
      .map((line) => line.textContent)
      .join(' ');

    expect(long).toHaveLength(139);
    expect(block.getAttribute('class')).not.toContain('aisf-shape-flagged');
    expect(shown).toBe(long);
  });

  it('should read pending Q3 when a fn is pending', async () => {
    await mount(
      playback(
        withFns([{ id: 'execute', sig: 'execute()', mark: 'new', does: 'x', pending: 'Q3' }]),
      ),
    );

    expect($('[data-fn="useCase.execute"]').textContent).toContain('pending Q3');
  });

  it('should draw one flagged error box and not throw when the JSON does not parse', async () => {
    await mount(playback('{ nope'));

    expect($$('aisf-playback svg[data-error] .aisf-shape-flagged')).toHaveLength(1);
    expect($$('[data-class]')).toHaveLength(0);
  });

  it('should fold an untouched module into one box and unfold it when clicked', async () => {
    const quiet = data({
      modules: [{ id: 'm', mark: 'untouched', tag: 'untouched', does: 'reads things' }],
      classes: [
        {
          id: 'useCase',
          module: 'm',
          layer: 'business',
          file: 'use-case.ts',
          name: 'UseCase',
          kind: 'use case',
          mark: 'untouched',
          fns: [{ id: 'execute', sig: 'execute(id)', mark: 'untouched', does: 'x', source: 's' }],
        },
      ],
      criteria: {},
    });
    await mount(playback(quiet));

    const folded = $<SVGElement>('[data-class="fold:m"]');
    expect(folded.textContent).toContain('reads things');
    expect($$('[data-class="useCase"]')).toHaveLength(0);
    await clickSvg($('[data-fold="m"]'));

    expect($$('[data-class="useCase"]')).toHaveLength(1);
  });

  it('should carry aisf-shape-removed when a class is removed', async () => {
    const base = data() as { classes: Array<Record<string, unknown>> };
    await mount(playback(data({ classes: [{ ...base.classes[0], mark: 'removed' }] })));

    expect($('[data-class="useCase"]').getAttribute('class')).toContain('aisf-shape-removed');
  });

  it('should set every svg text to at least 12 when drawn', async () => {
    await mount(playback(mockPlayback));

    const texts = $$<SVGElement>('aisf-playback svg text');

    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((text) => parseFloat(text.style.fontSize) >= 12)).toBe(true);
  });

  it('should pin a block when it is clicked and release it when empty space is clicked', async () => {
    await mount(playback(data()));

    await clickSvg($('[data-fn="useCase.retry"]'));
    const pinned = $('[data-fn="useCase.retry"]').hasAttribute('data-focus');
    await clickSvg($('.aisf-pb-svg'));

    expect(pinned).toBe(true);
    expect($('[data-fn="useCase.retry"]').hasAttribute('data-focus')).toBe(false);
  });
});
