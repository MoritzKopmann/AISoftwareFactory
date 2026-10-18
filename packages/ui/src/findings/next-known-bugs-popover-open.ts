export type KnownBugsPopoverEvent = 'pointer-enter' | 'pointer-leave' | 'toggle' | 'escape';

export function nextKnownBugsPopoverOpen(open: boolean, event: KnownBugsPopoverEvent): boolean {
  if (event === 'pointer-enter') {
    return true;
  }
  if (event === 'toggle') {
    return !open;
  }
  return false;
}
