// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildView,
  fnFlag,
  foldableModules,
  parsePlayback,
} from '../../../../assets/kit/support/playback-data.js';
import { mockPlayback } from '../fixtures/playback-mock.js';

function host(json: string): Element {
  const element = document.createElement('div');
  const script = document.createElement('script');
  script.type = 'application/json';
  script.textContent = json;
  element.append(script);
  return element;
}

describe('parsePlayback', () => {
  it('should return the data when the JSON child is valid', () => {
    const parsed = parsePlayback(host(JSON.stringify(mockPlayback)));

    expect('data' in parsed && parsed.data.classes.length).toBe(mockPlayback.classes.length);
  });

  it('should return an error when the JSON does not parse', () => {
    const parsed = parsePlayback(host('{ nope'));

    expect(parsed).toEqual({ error: expect.stringContaining('does not parse') as string });
  });

  it('should return an error when there is no JSON child', () => {
    expect(parsePlayback(document.createElement('div'))).toHaveProperty('error');
  });

  it('should return an error when the JSON is not an object', () => {
    expect(parsePlayback(host('[1]'))).toHaveProperty('error');
  });
});

describe('fnFlag', () => {
  it('should flag a changed fn when it has no source', () => {
    const flag = fnFlag({ id: 'a', sig: 'a()', mark: 'changed', does: 'x' });

    expect(flag).toContain('names no source');
  });

  it('should not flag a new fn when it has no source', () => {
    expect(fnFlag({ id: 'a', sig: 'a()', mark: 'new', does: 'x' })).toBeNull();
  });

  it('should not flag a changed fn when it has a source', () => {
    expect(
      fnFlag({ id: 'a', sig: 'a()', mark: 'changed', does: 'x', source: 'src/a.ts' }),
    ).toBeNull();
  });
});

describe('foldableModules', () => {
  it('should list only layered modules whose classes are all untouched', () => {
    const folded = foldableModules(mockPlayback as never);

    expect([...folded]).toEqual(['tickets']);
  });
});

describe('buildView', () => {
  it('should letter the paths A and B when a criterion has two', () => {
    const view = buildView(mockPlayback as never, new Set());
    const ac3 = view.find((entry) => entry.key === 'AC3');

    expect(ac3?.paths.map((path) => path.run)).toEqual(['A', 'B']);
    expect(ac3?.steps[0]?.num).toBe('A1');
  });

  it('should leave the run empty when a criterion has one path', () => {
    const view = buildView(mockPlayback as never, new Set());

    expect(view.find((entry) => entry.key === 'AC1')?.steps[0]?.num).toBe('1');
  });

  it('should collapse steps inside a folded module into one hop', () => {
    const open = buildView(mockPlayback as never, new Set());
    const folded = buildView(mockPlayback as never, new Set(['tickets']));
    const ac1 = (views: typeof open) =>
      views.find((entry) => entry.key === 'AC1')?.steps.length ?? 0;

    expect(ac1(folded)).toBeLessThan(ac1(open));
    expect(folded[0]?.steps.some((step) => step.to === 'fold:tickets.in')).toBe(true);
  });

  it('should flag a step when it names an unknown function', () => {
    const data = {
      ...mockPlayback,
      criteria: {
        AC1: {
          title: 't',
          paths: [{ actor: 'x', steps: [[null, 'nope.fn', 'c', 'entry']], end: ['nope.fn', 'e'] }],
        },
      },
    };

    const view = buildView(data as never, new Set());

    expect(view[0]?.steps[0]?.flag).toContain('nope.fn');
  });
});
