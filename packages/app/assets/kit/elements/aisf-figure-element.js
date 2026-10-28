import { buildElement, setPart } from '../support/dom.js';

export class AisfFigureElement extends HTMLElement {
  static observedAttributes = ['caption', 'wide'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /**
   * Internal. Shows the caption after the figure; the figure itself is left as written.
   * Inside a question the caption sits above and the content moves into its own frame.
   */
  render() {
    const caption = this.getAttribute('caption');
    const captionPart =
      caption === null ? undefined : buildElement('figcaption', 'aisf-figure-caption', caption);
    if (this.closest('aisf-question') === null) {
      setPart(this, 'aisf-figure-caption', captionPart);
      return;
    }
    this.wrapContentInFrame();
    setPart(this, 'aisf-figure-caption', captionPart, 'start');
  }

  /** Internal. Moves the author's content into one frame element, once. */
  wrapContentInFrame() {
    if ([...this.children].some((child) => child.classList.contains('aisf-figure-frame'))) return;
    const frame = buildElement('div', 'aisf-figure-frame');
    frame.append(...[...this.childNodes].filter((node) => !isCaption(node)));
    this.append(frame);
  }
}

/** @param {Node} node */
function isCaption(node) {
  return node instanceof Element && node.classList.contains('aisf-figure-caption');
}
