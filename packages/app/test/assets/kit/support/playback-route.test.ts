import { describe, expect, it } from 'vitest';
import { buildView, foldableModules } from '../../../../assets/kit/support/playback-data.js';
import { layoutPlayback } from '../../../../assets/kit/support/playback-layout.js';
import { blocksByRef, routeWires } from '../../../../assets/kit/support/playback-route.js';
import { mockPlayback } from '../fixtures/playback-mock.js';

describe('routeWires', () => {
  const data = mockPlayback as never;

  describe.each([1440, 1920])('at width %i', (width) => {
    const folded = foldableModules(data);
    const layout = layoutPlayback(data, { width, folded });
    const steps = buildView(data, folded).flatMap((entry) => entry.steps);
    const routed = routeWires(
      layout,
      steps.map((step, index) => ({ key: String(index), from: step.from, to: step.to })),
    );
    const blocks = blocksByRef(layout);

    it('should route every wire when the data is the mock', () => {
      expect(routed).toHaveLength(steps.length);
    });

    it('should start on the right edge of the source block and end on the left edge of the target', () => {
      for (const wire of routed) {
        const target = blocks.get(wire.to)?.block;
        const last = wire.points[wire.points.length - 1];
        expect(last?.x).toBe(target?.x);
        expect(last?.y).toBeGreaterThanOrEqual(target?.y ?? 0);
        expect(last?.y).toBeLessThanOrEqual((target?.y ?? 0) + (target?.h ?? 0));
        if (wire.from === null) continue;
        const source = blocks.get(wire.from)?.block;
        const first = wire.points[0];
        expect(first?.x).toBe((source?.x ?? 0) + (source?.w ?? 0));
        expect(first?.y).toBeGreaterThanOrEqual(source?.y ?? 0);
        expect(first?.y).toBeLessThanOrEqual((source?.y ?? 0) + (source?.h ?? 0));
      }
    });

    it('should cross no box when a wire runs between its ends', () => {
      const crossings: string[] = [];
      for (const wire of routed) {
        for (let k = 1; k < wire.points.length; k += 1) {
          const a = wire.points[k - 1];
          const b = wire.points[k];
          if (a === undefined || b === undefined) continue;
          for (const box of layout.boxes) {
            const hits =
              Math.max(a.x, b.x) > box.x &&
              Math.min(a.x, b.x) < box.x + box.w &&
              Math.max(a.y, b.y) > box.y &&
              Math.min(a.y, b.y) < box.y + box.h;
            if (hits) crossings.push(`${wire.key} ${box.id}`);
          }
        }
      }
      expect(crossings).toEqual([]);
    });
  });

  it('should leave out a wire when its target is not drawn', () => {
    const layout = layoutPlayback(data, { width: 1920, folded: new Set() });

    const routed = routeWires(layout, [{ key: 'x', from: null, to: 'nope.fn' }]);

    expect(routed).toEqual([]);
  });
});
