import { buildElement, setPart } from '../support/dom.js';

export class AisfContextElement extends HTMLElement {
  static observedAttributes = ['kind', 'path', 'line'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /** Internal. Labels the kind; a code excerpt becomes numbered lines with the marked one. */
  render() {
    const kind = this.getAttribute('kind');
    const path = this.getAttribute('path');
    if (kind === 'code' && this.querySelector('.aisf-code') === null) this.buildCode();
    setPart(
      this,
      'aisf-context-kind',
      kind === null ? undefined : buildElement('span', 'aisf-context-kind', kind),
      'start',
    );
    setPart(
      this,
      'aisf-context-path',
      kind === 'code' && path !== null
        ? buildElement('span', 'aisf-context-path', path)
        : undefined,
      'start',
    );
    const code = this.querySelector('.aisf-code');
    if (code !== null) this.markLine(code);
  }

  /** Internal. Turns the written excerpt into one element per line. */
  buildCode() {
    const code = buildElement('pre', 'aisf-code');
    for (const text of (this.textContent ?? '').replace(/\n$/, '').split('\n')) {
      code.append(buildElement('span', 'aisf-code-line', text));
    }
    this.replaceChildren(code);
  }

  /** @param {Element} code */
  markLine(code) {
    const marked = Number(this.getAttribute('line'));
    [...code.children].forEach((line, index) => {
      line.classList.toggle('aisf-code-line-marked', index + 1 === marked);
    });
  }
}
