import { describe, expect, it } from 'vitest';
import { foldableModules } from '../../../../assets/kit/support/playback-data.js';
import {
  BLOCK_GAP,
  layoutPlayback,
  wrapText,
} from '../../../../assets/kit/support/playback-layout.js';
import { mockPlayback } from '../fixtures/playback-mock.js';

describe('wrapText', () => {
  it('should break at spaces when the text is longer than the limit', () => {
    expect(wrapText('one two three', 7)).toEqual(['one two', 'three']);
  });

  it('should break an identifier at a word join when it is longer than the limit', () => {
    expect(wrapText('updateSettingsNow', 12)).toEqual(['update', 'SettingsNow']);
  });

  it('should return no line when the text is empty', () => {
    expect(wrapText('', 10)).toEqual([]);
  });
});

describe('layoutPlayback', () => {
  const data = mockPlayback as never;

  it.each([1440, 1920])('should fit the given width when laid out at %i', (width) => {
    const layout = layoutPlayback(data, { width, folded: foldableModules(data) });

    expect(layout.width).toBeLessThanOrEqual(width);
  });

  it('should put the frontend module first when it is listed later', () => {
    const reversed = { ...mockPlayback, modules: [...mockPlayback.modules].reverse() } as never;

    const layout = layoutPlayback(reversed, { width: 1920, folded: new Set() });

    expect(layout.modules[0]?.frontend).toBe(true);
  });

  it('should draw one stand-in box when a module is folded', () => {
    const layout = layoutPlayback(data, { width: 1920, folded: new Set(['tickets']) });

    const boxes = layout.boxes.filter((box) => box.moduleId === 'tickets');

    expect(boxes.map((box) => box.id)).toEqual(['fold:tickets']);
    expect(boxes[0]?.blocks[0]?.doesLines.join(' ')).toContain('Click to unfold');
  });

  it('should draw the class boxes of a module when it is unfolded', () => {
    const layout = layoutPlayback(data, { width: 1920, folded: new Set() });

    const boxes = layout.boxes.filter((box) => box.moduleId === 'tickets');

    expect(boxes).toHaveLength(3);
  });

  it('should stack boxes of one module and layer in one column', () => {
    const layout = layoutPlayback(data, { width: 1920, folded: new Set() });

    const cell = layout.boxes.filter(
      (box) => box.moduleId === 'notifications' && ['logRepo', 'ticketsAdapter'].includes(box.id),
    );

    expect(new Set(cell.map((box) => box.x)).size).toBe(1);
    expect(cell[1]?.y).toBeGreaterThan((cell[0]?.y ?? 0) + (cell[0]?.h ?? 0));
  });

  it('should stack modules into more than one band when they do not fit the width', () => {
    const layout = layoutPlayback(data, { width: 1100, folded: new Set() });

    expect(layout.bands).toBeGreaterThan(1);
  });
});

describe('layoutPlayback block gap', () => {
  function oneClass(count: number) {
    const fns = Array.from({ length: count }, (_, index) => ({
      id: `f${index}`,
      sig: `f${index}()`,
      mark: 'new',
      does: 'Does.',
    }));
    return {
      modules: [{ id: 'm', mark: 'changed', tag: 'changed' }],
      screens: [],
      classes: [
        {
          id: 'c',
          module: 'm',
          layer: 'business',
          file: 'c.ts',
          name: 'C',
          kind: 'use case',
          mark: 'changed',
          fns,
        },
      ],
      criteria: {},
    } as never;
  }

  const options = { width: 1440, folded: new Set<string>() };

  it('should put BLOCK_GAP between blocks when a class has three functions', () => {
    const blocks = layoutPlayback(oneClass(3), options).boxes[0]?.blocks ?? [];

    expect(BLOCK_GAP).toBe(12);
    expect(blocks).toHaveLength(3);
    expect((blocks[1]?.y ?? 0) - ((blocks[0]?.y ?? 0) + (blocks[0]?.h ?? 0))).toBe(BLOCK_GAP);
    expect((blocks[2]?.y ?? 0) - ((blocks[1]?.y ?? 0) + (blocks[1]?.h ?? 0))).toBe(BLOCK_GAP);
  });

  it('should count two gaps in the box height when a class has three functions', () => {
    const box = layoutPlayback(oneClass(3), options).boxes[0];

    const last = box?.blocks[2];

    expect((box?.y ?? 0) + (box?.h ?? 0)).toBe((last?.y ?? 0) + (last?.h ?? 0));
    const single = layoutPlayback(oneClass(1), options).boxes[0];
    const first = single?.blocks[0];
    expect((single?.y ?? 0) + (single?.h ?? 0)).toBe((first?.y ?? 0) + (first?.h ?? 0));
  });
});
