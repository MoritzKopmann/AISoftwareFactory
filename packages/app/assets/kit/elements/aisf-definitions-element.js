import { buildElement } from '../support/dom.js';

/** Terms explained: a `<dl>` behind a collapsed toggle. Never part of the answer. */
export class AisfDefinitionsElement extends HTMLElement {
  /** @type {string[]} */
  static observedAttributes = [];

  connectedCallback() {
    this.render();
  }

  /** Internal. Wraps the written content in a collapsed body behind a toggle, once. */
  render() {
    if (this.querySelector('.aisf-definitions-toggle') !== null) return;
    const body = buildElement('div', 'aisf-definitions-body');
    body.hidden = true;
    body.append(...this.childNodes);
    const toggle = buildElement('button', 'aisf-definitions-toggle', 'Terms explained');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      body.hidden = !body.hidden;
      toggle.setAttribute('aria-expanded', String(!body.hidden));
    });
    this.append(toggle, body);
  }
}
