// Covers fractional scroll positions from zoom and high-density screens.
export const bottomThresholdPx = 4;

export type ScrollBox = Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>;

export function isScrolledToBottom(box: ScrollBox): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= bottomThresholdPx;
}
