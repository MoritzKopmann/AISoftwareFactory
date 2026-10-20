import { buildElement } from '../support/dom.js';

export class AisfMoreElement extends HTMLElement {
  /** @type {string[]} */
  static observedAttributes = [];

  connectedCallback() {
    this.render();
  }

  /** Internal. Wraps the written content in a collapsed body behind a More toggle, once. */
  render() {
    if (this.querySelector('.aisf-more-toggle') !== null) return;
    const body = buildElement('div', 'aisf-more-body');
    body.hidden = true;
    body.append(...this.childNodes);
    const toggle = buildElement('button', 'aisf-more-toggle', 'More');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      body.hidden = !body.hidden;
      toggle.setAttribute('aria-expanded', String(!body.hidden));
    });
    this.append(toggle, body);
  }
}
