import { announceChange, buildElement, isRecord } from '../support/dom.js';

/**
 * Decisions settled by precedent, each with a veto switch and an optional note. Items are the
 * element's children carrying a `name` and optionally a `source` attribute; their text is the
 * decision.
 */
export class AisfPrecedentElement extends HTMLElement {
  /** @type {string[]} */
  static observedAttributes = [];

  connectedCallback() {
    this.render();
  }

  /** @returns {HTMLElement[]} */
  get items() {
    return /** @type {HTMLElement[]} */ (
      [...this.children].filter((child) => child.hasAttribute('name'))
    );
  }

  /** For the round: the vetoed decisions, `{name: note}`. @returns {Record<string, string>} */
  get vetoes() {
    /** @type {Record<string, string>} */
    const vetoes = {};
    for (const item of this.items) {
      if (item.hasAttribute('vetoed'))
        vetoes[item.getAttribute('name') ?? ''] = this.noteOf(item).value;
    }
    return vetoes;
  }

  /**
   * For the round: puts saved vetoes on screen.
   * @param {unknown} saved
   */
  restore(saved) {
    if (!isRecord(saved)) return;
    for (const item of this.items) {
      const note = saved[item.getAttribute('name') ?? ''];
      if (typeof note !== 'string') continue;
      this.setVetoed(item, true);
      this.noteOf(item).value = note;
    }
  }

  /** For the round: locks or unlocks every switch and note. @param {boolean} locked */
  setLocked(locked) {
    for (const item of this.items) {
      /** @type {HTMLButtonElement} */ (item.querySelector('.aisf-veto-switch')).disabled = locked;
      this.noteOf(item).disabled = locked;
    }
  }

  /**
   * @param {HTMLElement} item
   * @returns {HTMLTextAreaElement}
   */
  noteOf(item) {
    return /** @type {HTMLTextAreaElement} */ (item.querySelector('.aisf-veto-note'));
  }

  /**
   * @param {HTMLElement} item
   * @param {boolean} vetoed
   */
  setVetoed(item, vetoed) {
    item.toggleAttribute('vetoed', vetoed);
    item.querySelector('.aisf-veto-switch')?.setAttribute('aria-checked', String(vetoed));
    this.noteOf(item).hidden = !vetoed;
  }

  /** Internal. Builds each item's text, source, veto switch and note once. */
  render() {
    for (const item of this.items) {
      if (item.querySelector('.aisf-veto-switch') !== null) continue;
      const text = buildElement('span', 'aisf-precedent-text', item.textContent ?? '');
      item.replaceChildren(text);
      const source = item.getAttribute('source');
      if (source !== null) item.append(buildElement('span', 'aisf-precedent-source', source));
      const toggle = buildElement('button', 'aisf-veto-switch', 'veto');
      toggle.type = 'button';
      toggle.setAttribute('role', 'switch');
      toggle.addEventListener('click', () => {
        this.setVetoed(item, !item.hasAttribute('vetoed'));
        announceChange(this);
      });
      const note = buildElement('textarea', 'aisf-veto-note');
      note.setAttribute('aria-label', 'Veto note');
      note.addEventListener('input', () => announceChange(this));
      item.append(toggle, note);
      this.setVetoed(item, false);
    }
  }
}
