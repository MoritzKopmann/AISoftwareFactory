import { describe, expect, it } from 'vitest';
import { nextKnownBugsPopoverOpen } from './next-known-bugs-popover-open.js';

describe('nextKnownBugsPopoverOpen', () => {
  it('should open when the pointer enters', () => {
    expect(nextKnownBugsPopoverOpen(false, 'pointer-enter')).toBe(true);
  });

  it('should stay open when the pointer enters an open popover', () => {
    expect(nextKnownBugsPopoverOpen(true, 'pointer-enter')).toBe(true);
  });

  it('should close when the pointer leaves', () => {
    expect(nextKnownBugsPopoverOpen(true, 'pointer-leave')).toBe(false);
  });

  it('should open when the trigger is clicked while closed', () => {
    expect(nextKnownBugsPopoverOpen(false, 'toggle')).toBe(true);
  });

  it('should close when the trigger is clicked while open', () => {
    expect(nextKnownBugsPopoverOpen(true, 'toggle')).toBe(false);
  });

  it('should close when Escape is pressed', () => {
    expect(nextKnownBugsPopoverOpen(true, 'escape')).toBe(false);
  });
});
