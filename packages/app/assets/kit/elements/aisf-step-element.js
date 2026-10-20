import { redrawHost } from '../support/svg.js';

/** One arrow of an `aisf-sequence` or `aisf-state`. Draws nothing itself. */
export class AisfStepElement extends HTMLElement {
  static observedAttributes = ['from', 'to', 'mark'];

  attributeChangedCallback() {
    redrawHost(this, 'aisf-sequence, aisf-state');
  }
}
