export type DescriptionToggleView =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'shown'; readonly label: string; readonly expanded: boolean };

export type DescriptionSwap = {
  readonly toggle: DescriptionToggleView;
  // Which panel the lower slot shows. The round panel stays mounted while it is hidden.
  readonly panel: 'description' | 'round';
};

export function describeDescriptionSwap(roundUp: boolean, open: boolean): DescriptionSwap {
  if (!roundUp) {
    return { toggle: { kind: 'hidden' }, panel: 'description' };
  }
  return {
    toggle: {
      kind: 'shown',
      label: open ? 'Hide description' : 'Show description',
      expanded: open,
    },
    panel: open ? 'description' : 'round',
  };
}

// A round that ends closes the toggle, so the next round starts closed.
export function settleDescriptionOpen(open: boolean, roundUp: boolean): boolean {
  return open && roundUp;
}
