import { announceChange, buildElement, setPart } from '../support/dom.js';

export class AisfTaskElement extends HTMLElement {
  static observedAttributes = ['number', 'heading', 'blocked-by', 'files', 'risk', 'hitl'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  /** @returns {string | null} */
  get number() {
    return this.getAttribute('number');
  }

  /** @returns {boolean} the hitl switch, as the human set it */
  get hitl() {
    return this.hasAttribute('hitl');
  }

  /** For the confirm: sets the switch. @param {boolean} value */
  setHitl(value) {
    this.toggleAttribute('hitl', value);
  }

  /** For the confirm: locks the switch. @param {boolean} locked */
  setLocked(locked) {
    const button = this.querySelector('.aisf-hitl-switch');
    if (button instanceof HTMLButtonElement) button.disabled = locked;
  }

  /** Internal. Builds the task head, the detail lines and the hitl switch. */
  render() {
    const head = buildElement('div', 'aisf-task-head');
    const number = this.getAttribute('number');
    if (number !== null) head.append(buildElement('span', 'aisf-task-number', `#${number}`));
    head.append(buildElement('span', 'aisf-task-heading', this.getAttribute('heading') ?? ''));
    setPart(this, 'aisf-task-head', head, 'start');
    const details = buildElement('div', 'aisf-task-details');
    /** @type {Array<[string, string]>} */
    const detailAttributes = [
      ['blocked-by', 'blocked by'],
      ['files', 'files'],
      ['risk', 'risk'],
    ];
    for (const [attribute, label] of detailAttributes) {
      const value = this.getAttribute(attribute);
      if (value !== null)
        details.append(buildElement('span', `aisf-task-${attribute}`, `${label}: ${value}`));
    }
    setPart(this, 'aisf-task-details', details.children.length === 0 ? undefined : details);
    this.renderSwitch();
  }

  /** Internal. Keeps one switch and mirrors the `hitl` attribute onto it. */
  renderSwitch() {
    const existing = this.querySelector('.aisf-hitl-switch');
    const button =
      existing instanceof HTMLButtonElement
        ? existing
        : buildElement('button', 'aisf-hitl-switch', 'hitl');
    if (button !== existing) {
      button.type = 'button';
      button.setAttribute('role', 'switch');
      button.addEventListener('click', () => {
        this.setHitl(!this.hitl);
        announceChange(this);
      });
      this.append(button);
    }
    button.setAttribute('aria-checked', String(this.hitl));
  }
}
