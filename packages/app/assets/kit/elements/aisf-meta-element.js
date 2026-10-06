import { buildElement, setPart } from '../support/dom.js';

export class AisfMetaElement extends HTMLElement {
  static observedAttributes = ['label'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /** Internal. Shows the label before the value. */
  render() {
    const label = this.getAttribute('label');
    setPart(
      this,
      'aisf-meta-label',
      label === null ? undefined : buildElement('span', 'aisf-meta-label', label),
      'start',
    );
  }
}
