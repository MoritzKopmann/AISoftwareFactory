import { announceChange, buildElement, setPart } from '../support/dom.js';

let nextQuestionId = 0;

/** @typedef {{ question: string, choice: string, text?: string, note?: string }} Answer */

export class AisfQuestionElement extends HTMLElement {
  static observedAttributes = ['name', 'heading', 'assumes'];

  connectedCallback() {
    this.render();
    this.addEventListener('input', this.onEdit);
    this.addEventListener('change', this.onEdit);
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.onEdit);
    this.removeEventListener('change', this.onEdit);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  /** @returns {Element[]} */
  get cards() {
    const cards = [...this.querySelectorAll('aisf-card')];
    // A question can connect before its cards are upgraded.
    for (const card of cards) customElements.upgrade(card);
    return cards;
  }

  /** @param {string} selector @returns {HTMLInputElement} */
  field(selector) {
    return /** @type {HTMLInputElement} */ (this.querySelector(selector));
  }

  /** @returns {Answer | undefined} the chosen answer, even an incomplete one */
  get answer() {
    const name = this.getAttribute('name') ?? '';
    for (const card of this.cards) {
      const radio = /** @type {any} */ (card).radio;
      if (radio?.checked) return { question: name, choice: card.getAttribute('value') ?? '' };
    }
    if (this.field('.aisf-other-radio')?.checked) {
      return { question: name, choice: 'other', text: this.field('.aisf-other-text').value };
    }
    if (this.field('.aisf-discuss-radio')?.checked) {
      const note = this.field('.aisf-discuss-note').value;
      return note === ''
        ? { question: name, choice: 'discuss' }
        : { question: name, choice: 'discuss', note };
    }
    return undefined;
  }

  /** @returns {boolean} whether the question has a complete answer */
  get isAnswered() {
    const answer = this.answer;
    if (answer === undefined) return false;
    return answer.choice !== 'other' || (answer.text ?? '').trim() !== '';
  }

  /** @returns {Element | undefined} the card marked `suggested` */
  get suggestedCard() {
    return this.cards.find((card) => card.hasAttribute('suggested'));
  }

  /**
   * For the round: puts a saved answer on screen.
   * @param {Answer | undefined} answer
   */
  setAnswer(answer) {
    for (const card of this.cards) {
      const radio = /** @type {any} */ (card).radio;
      if (radio)
        radio.checked = answer !== undefined && card.getAttribute('value') === answer.choice;
    }
    this.field('.aisf-other-radio').checked = answer?.choice === 'other';
    this.field('.aisf-other-text').value = answer?.choice === 'other' ? (answer.text ?? '') : '';
    this.field('.aisf-discuss-radio').checked = answer?.choice === 'discuss';
    this.field('.aisf-discuss-note').value =
      answer?.choice === 'discuss' ? (answer.note ?? '') : '';
    this.sync();
  }

  /** For the round: selects the suggested card. @returns {boolean} whether there was one */
  acceptSuggestion() {
    const card = this.suggestedCard;
    if (card === undefined) return false;
    this.setAnswer({
      question: this.getAttribute('name') ?? '',
      choice: card.getAttribute('value') ?? '',
    });
    return true;
  }

  /** For the round: locks or unlocks every input. @param {boolean} locked */
  setLocked(locked) {
    for (const input of this.querySelectorAll('input, textarea')) {
      /** @type {HTMLInputElement} */ (input).disabled = locked;
    }
  }

  /** For the round: replaces the choices by a read-only summary. @param {boolean} frozen */
  setFrozen(frozen) {
    this.querySelector('.aisf-choices')?.toggleAttribute('hidden', frozen);
    if (!frozen) {
      setPart(this, 'aisf-frozen-summary', undefined);
      return;
    }
    const summary = buildElement('div', 'aisf-frozen-summary');
    summary.append(
      buildElement('span', 'aisf-summary-decision', this.getAttribute('heading') ?? ''),
    );
    summary.append(buildElement('span', 'aisf-summary-answer', this.answerLabel()));
    const assumes = this.getAttribute('assumes');
    if (assumes !== null)
      summary.append(buildElement('span', 'aisf-summary-assumes', `assumes: ${assumes}`));
    setPart(this, 'aisf-frozen-summary', summary);
  }

  /** @returns {string} the answer as the human reads it */
  answerLabel() {
    const answer = this.answer;
    if (answer === undefined) return '';
    if (answer.choice === 'other') return `Other: ${answer.text ?? ''}`;
    if (answer.choice === 'discuss')
      return answer.note === undefined ? 'Discuss' : `Discuss: ${answer.note}`;
    const card = this.cards.find((candidate) => candidate.getAttribute('value') === answer.choice);
    return /** @type {any} */ (card)?.label || answer.choice;
  }

  /** Internal. Builds the heading, the choice group and the Other and Discuss choices once. */
  render() {
    const heading = this.getAttribute('heading');
    setPart(
      this,
      'aisf-question-heading',
      heading === null ? undefined : buildElement('h3', 'aisf-question-heading', heading),
      'start',
    );
    const assumes = this.getAttribute('assumes');
    setPart(
      this,
      'aisf-question-assumes',
      assumes === null
        ? undefined
        : buildElement('p', 'aisf-question-assumes', `assumes: ${assumes}`),
    );
    if (this.querySelector('.aisf-choices') !== null) return;
    const group = buildElement('div', 'aisf-choices');
    group.setAttribute('role', 'radiogroup');
    const groupName = `aisf-question-${nextQuestionId++}`;
    for (const card of this.cards) {
      group.append(card);
      /** @type {any} */ (card).render();
    }
    group.append(
      this.extraChoice('other', 'Other', 'input'),
      this.extraChoice('discuss', 'Discuss', 'textarea'),
    );
    for (const radio of group.querySelectorAll('input[type=radio]')) {
      /** @type {HTMLInputElement} */ (radio).name = groupName;
    }
    this.append(group);
    this.initialFromMarkup();
  }

  /**
   * @param {'other' | 'discuss'} kind
   * @param {string} label
   * @param {'input' | 'textarea'} fieldTag
   */
  extraChoice(kind, label, fieldTag) {
    const wrapper = buildElement('label', `aisf-choice aisf-choice-${kind}`);
    const radio = buildElement('input', `aisf-${kind}-radio`);
    radio.type = 'radio';
    const field = buildElement(
      fieldTag,
      kind === 'other' ? 'aisf-other-text' : 'aisf-discuss-note',
    );
    field.setAttribute('aria-label', kind === 'other' ? 'Other answer' : 'Note for the discussion');
    wrapper.append(radio, buildElement('span', 'aisf-choice-label', label), field);
    return wrapper;
  }

  /** Internal. A card written with `selected` counts as chosen: the specimens page uses it. */
  initialFromMarkup() {
    const card = this.cards.find((candidate) => candidate.hasAttribute('selected'));
    if (card !== undefined) {
      /** @type {any} */ (card).radio.checked = true;
    }
    this.sync();
  }

  /** @param {Event} event */
  onEdit = (event) => {
    if (event.type === 'change' && event.target instanceof HTMLTextAreaElement) return;
    const target = /** @type {Element} */ (event.target);
    if (target.classList.contains('aisf-other-text'))
      this.field('.aisf-other-radio').checked = true;
    if (target.classList.contains('aisf-discuss-note'))
      this.field('.aisf-discuss-radio').checked = true;
    this.sync();
    announceChange(this);
  };

  /** Internal. Sets the state hooks from the inputs. */
  sync() {
    const answer = this.answer;
    for (const card of this.cards) {
      card.toggleAttribute('selected', answer?.choice === card.getAttribute('value'));
    }
    this.toggleAttribute('answered', this.isAnswered);
  }
}
