import { buildElement, setPart } from '../support/dom.js';

export class AisfFigureElement extends HTMLElement {
  static observedAttributes = ['caption'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /** Internal. Shows the caption after the figure; the figure itself is left as written. */
  render() {
    const caption = this.getAttribute('caption');
    setPart(
      this,
      'aisf-figure-caption',
      caption === null ? undefined : buildElement('figcaption', 'aisf-figure-caption', caption),
    );
  }
}
