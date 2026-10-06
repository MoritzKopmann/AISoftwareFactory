import { buildElement, setPart } from '../support/dom.js';

let nextCardId = 0;

export class AisfCardElement extends HTMLElement {
  static observedAttributes = ['value', 'suggested', 'why'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /** @returns {HTMLInputElement | undefined} the generated radio */
  get radio() {
    return this.querySelector('input.aisf-card-radio') ?? undefined;
  }

  /** @returns {string} the card's label: the first line of its body */
  get label() {
    const body = this.querySelector('.aisf-card-body');
    return (body?.textContent ?? '').trim().split('\n')[0]?.trim() ?? '';
  }

  /** Internal. Wraps the written content in a choice with a radio; adds the tag and why line. */
  render() {
    let choice = [...this.children].find((child) => child.classList.contains('aisf-card-choice'));
    if (choice === undefined) {
      const radio = buildElement('input', 'aisf-card-radio');
      radio.type = 'radio';
      radio.id = `aisf-card-${nextCardId++}`;
      const body = buildElement('span', 'aisf-card-body');
      body.append(...this.childNodes);
      choice = buildElement('label', 'aisf-card-choice');
      choice.setAttribute('for', radio.id);
      choice.append(radio, body);
      this.append(choice);
    }
    const suggested = this.hasAttribute('suggested');
    setPart(
      this,
      'aisf-suggested-tag',
      suggested ? buildElement('span', 'aisf-suggested-tag', 'Suggested') : undefined,
    );
    const why = this.getAttribute('why');
    setPart(
      this,
      'aisf-card-why',
      why === null ? undefined : buildElement('p', 'aisf-card-why', why),
    );
  }
}
