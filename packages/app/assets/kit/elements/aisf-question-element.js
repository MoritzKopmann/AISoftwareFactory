import { announceChange, buildElement, setPart } from '../support/dom.js';

let nextQuestionId = 0;

const TEXT_CHOICE = 'text';

/** @typedef {{ question: string, choice: string, text?: string }} Answer */

export class AisfQuestionElement extends HTMLElement {
  static observedAttributes = ['name', 'heading', 'assumes', 'problem'];

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
    const text = this.field('.aisf-text-answer')?.value ?? '';
    if (text.trim() !== '') return { question: name, choice: TEXT_CHOICE, text };
    return undefined;
  }

  /** @returns {boolean} whether the question has a complete answer */
  get isAnswered() {
    return this.answer !== undefined;
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
        radio.checked =
          answer !== undefined &&
          answer.choice !== TEXT_CHOICE &&
          card.getAttribute('value') === answer.choice;
    }
    this.field('.aisf-text-answer').value =
      answer?.choice === TEXT_CHOICE ? (answer.text ?? '') : '';
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
    if (answer.choice === TEXT_CHOICE) return `Own answer: ${answer.text ?? ''}`;
    const card = this.cards.find((candidate) => candidate.getAttribute('value') === answer.choice);
    return /** @type {any} */ (card)?.label || answer.choice;
  }

  /** Internal. Builds the heading, the choice group and the text field once; places the parts in order. */
  render() {
    const heading = this.getAttribute('heading');
    setPart(
      this,
      'aisf-question-heading',
      heading === null ? undefined : buildElement('h3', 'aisf-question-heading', heading),
      'start',
    );
    const problem = this.getAttribute('problem');
    const headingPart = this.querySelector('.aisf-question-heading');
    const problemPart =
      problem === null ? undefined : buildElement('p', 'aisf-question-problem', problem);
    setPart(this, 'aisf-question-problem', problemPart, 'start');
    if (problemPart !== undefined) headingPart?.after(problemPart);
    this.placeDefinitions(problemPart ?? headingPart);
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
    group.append(this.textField());
    for (const radio of group.querySelectorAll('input[type=radio]')) {
      /** @type {HTMLInputElement} */ (radio).name = groupName;
    }
    this.append(group);
    this.initialFromMarkup();
  }

  /** @param {Element | null | undefined} precedingPart the problem or heading, if the question has one */
  placeDefinitions(precedingPart) {
    const definitions = this.querySelector(':scope > aisf-definitions');
    if (definitions === null) return;
    if (precedingPart === null || precedingPart === undefined) this.prepend(definitions);
    else precedingPart.after(definitions);
  }

  /** @returns {HTMLLabelElement} the one free text field */
  textField() {
    const wrapper = buildElement('label', 'aisf-text-field');
    const field = buildElement('textarea', 'aisf-text-answer');
    wrapper.append(buildElement('span', 'aisf-text-label', 'Or write your own answer'), field);
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
    if (target.classList.contains('aisf-text-answer')) {
      for (const card of this.cards) {
        const radio = /** @type {any} */ (card).radio;
        if (radio) radio.checked = false;
      }
    } else if (target.classList.contains('aisf-card-radio')) {
      this.field('.aisf-text-answer').value = '';
    }
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
