import { redrawHost } from '../support/svg.js';

/** One box of an `aisf-modmap`. Draws nothing itself. */
export class AisfUnitElement extends HTMLElement {
  static observedAttributes = ['module', 'layer', 'mark'];

  attributeChangedCallback() {
    redrawHost(this, 'aisf-modmap');
  }
}
