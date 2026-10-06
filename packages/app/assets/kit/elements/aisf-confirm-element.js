import { announceChange, buildElement, setPart } from '../support/dom.js';

export class AisfConfirmElement extends HTMLElement {
  /** @type {string[]} */
  static observedAttributes = [];

  connectedCallback() {
    this.render();
  }

  /** @returns {HTMLTextAreaElement} */
  get noteField() {
    return /** @type {HTMLTextAreaElement} */ (this.querySelector('.aisf-confirm-note'));
  }

  /** @returns {Element[]} */
  get tasks() {
    return [...this.querySelectorAll('aisf-task')];
  }

  /** For the round: the note and every task's hitl switch, as the human left them. */
  get draft() {
    /** @type {Record<string, boolean>} */
    const hitl = {};
    for (const task of this.tasks) {
      hitl[/** @type {any} */ (task).number ?? ''] = /** @type {any} */ (task).hitl;
    }
    return { note: this.noteField.value, hitl };
  }

  /**
   * For the round: puts a saved draft on screen.
   * @param {{ note?: unknown, hitl?: unknown } | undefined} draft
   */
  restore(draft) {
    if (draft === undefined) return;
    if (typeof draft.note === 'string') this.noteField.value = draft.note;
    const hitl = /** @type {Record<string, unknown>} */ (
      typeof draft.hitl === 'object' && draft.hitl !== null ? draft.hitl : {}
    );
    for (const task of this.tasks) {
      const saved = hitl[/** @type {any} */ (task).number ?? ''];
      if (typeof saved === 'boolean') /** @type {any} */ (task).setHitl(saved);
    }
  }

  /** For the round: locks or unlocks the note, the buttons and the switches. @param {boolean} locked */
  setLocked(locked) {
    this.noteField.disabled = locked;
    for (const button of this.querySelectorAll('.aisf-confirm-button, .aisf-reopen-button')) {
      /** @type {HTMLButtonElement} */ (button).disabled = locked;
    }
    for (const task of this.tasks) /** @type {any} */ (task).setLocked(locked);
  }

  /**
   * For the round: replaces the note and buttons by the decision and the note.
   * @param {boolean} frozen
   * @param {string} [decision]
   */
  setFrozen(frozen, decision = 'confirm') {
    this.querySelector('.aisf-confirm-actions')?.toggleAttribute('hidden', frozen);
    if (!frozen) {
      setPart(this, 'aisf-frozen-summary', undefined);
      return;
    }
    const summary = buildElement('div', 'aisf-frozen-summary');
    summary.append(
      buildElement(
        'span',
        'aisf-summary-decision',
        decision === 'reopen' ? 'Reopened' : 'Confirmed',
      ),
    );
    const note = this.noteField.value;
    if (note !== '') summary.append(buildElement('span', 'aisf-summary-note', note));
    setPart(this, 'aisf-frozen-summary', summary);
  }

  /** Internal. Builds the note field, Confirm and Reopen once. */
  render() {
    if (this.querySelector('.aisf-confirm-actions') !== null) return;
    const actions = buildElement('div', 'aisf-confirm-actions');
    const note = buildElement('textarea', 'aisf-confirm-note');
    note.setAttribute('aria-label', 'Note');
    note.addEventListener('input', () => announceChange(this));
    const confirm = buildElement('button', 'aisf-confirm-button', 'Confirm');
    const reopen = buildElement('button', 'aisf-reopen-button', 'Reopen');
    confirm.type = 'button';
    reopen.type = 'button';
    confirm.addEventListener('click', () => this.decide('confirm'));
    reopen.addEventListener('click', () => this.decide('reopen'));
    actions.append(note, confirm, reopen);
    this.append(actions);
  }

  /** @param {'confirm' | 'reopen'} decision */
  decide(decision) {
    if (decision === 'reopen' && this.noteField.value.trim() === '') {
      this.noteField.focus();
      return;
    }
    this.dispatchEvent(new CustomEvent('aisf-decide', { bubbles: true, detail: { decision } }));
  }
}
