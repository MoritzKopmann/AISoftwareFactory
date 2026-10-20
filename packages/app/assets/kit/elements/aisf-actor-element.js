import { redrawHost } from '../support/svg.js';

/** One lifeline column of an `aisf-sequence`. Draws nothing itself. */
export class AisfActorElement extends HTMLElement {
  static observedAttributes = ['name'];

  attributeChangedCallback() {
    redrawHost(this, 'aisf-sequence');
  }
}
