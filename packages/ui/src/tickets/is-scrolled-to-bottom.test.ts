import { describe, expect, it } from 'vitest';
import { bottomThresholdPx, isScrolledToBottom } from './is-scrolled-to-bottom.js';

describe('isScrolledToBottom', () => {
  it('should be true when the box is exactly at the bottom', () => {
    const box = { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 };

    expect(isScrolledToBottom(box)).toBe(true);
  });

  it('should be true when the box is within the threshold of the bottom', () => {
    const box = { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - bottomThresholdPx };

    expect(isScrolledToBottom(box)).toBe(true);
  });

  it('should be false when the box is one pixel past the threshold', () => {
    const box = { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - bottomThresholdPx - 1 };

    expect(isScrolledToBottom(box)).toBe(false);
  });

  it('should be true when the content is shorter than the box', () => {
    const box = { scrollHeight: 200, clientHeight: 400, scrollTop: 0 };

    expect(isScrolledToBottom(box)).toBe(true);
  });
});
