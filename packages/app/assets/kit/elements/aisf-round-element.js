import { buildElement, isRecord, setPart } from '../support/dom.js';
import { pageSession } from '../support/page-session.js';

export class AisfRoundElement extends HTMLElement {
  static observedAttributes = ['number'];

  session = pageSession();
  started = false;
  sendBusy = false;
  /** @type {'open' | 'busy' | 'closed'} */
  lastStatus = 'open';
  /** @type {(() => void) | undefined} */
  unsubscribe = undefined;

  connectedCallback() {
    if (this.started) return;
    this.started = true;

    this.lastStatus = this.status;
    this.sendBusy = false;
    this.unsubscribe = this.session.subscribe(() => this.refresh());
    this.addEventListener('aisf-change', this.onChange);
    this.addEventListener('aisf-decide', this.onDecide);
    void this.start();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.removeEventListener('aisf-change', this.onChange);
    this.removeEventListener('aisf-decide', this.onDecide);
    this.started = false;
  }

  /** @returns {number} */
  get number() {
    return Number(this.getAttribute('number'));
  }

  /** @returns {Element[]} */
  get questions() {
    return [...this.querySelectorAll('aisf-question')];
  }

  /** @returns {any} */
  get confirm() {
    return this.querySelector('aisf-confirm');
  }

  /** @returns {'open' | 'busy' | 'closed'} the page status, or the one a nearer section sets in markup */
  get status() {
    const near = this.closest('[data-aisf-status]');
    const value =
      near !== null && near !== document.documentElement
        ? near.getAttribute('data-aisf-status')
        : null;
    return value === 'busy' || value === 'closed' || value === 'open' ? value : this.session.status;
  }

  /** @returns {Record<string, any> | undefined} this round's saved state */
  get saved() {
    const value = this.session.state.rounds[String(this.number)];
    return isRecord(value) ? value : undefined;
  }

  /** Internal. Restores the saved draft once loaded, then shows the round. */
  async start() {
    await this.session.ready;
    const saved = this.saved;
    if (saved !== undefined) this.restore(saved);
    if (saved?.['submitted'] !== undefined) this.freeze(String(saved['submitted']));
    else if (this.hasAttribute('frozen')) this.freeze(this.getAttribute('frozen') || 'confirm');
    this.refresh();
  }

  /** @param {Record<string, any>} saved */
  restore(saved) {
    const answers = isRecord(saved['answers']) ? saved['answers'] : {};
    for (const question of this.questions) {
      const name = question.getAttribute('name') ?? '';
      const answer = answers[name];
      /** @type {any} */ (question).setAnswer(
        isRecord(answer) ? { question: name, ...answer } : undefined,
      );
    }
    this.confirm?.restore(saved);
  }

  /** @param {string} decision */
  freeze(decision) {
    this.setAttribute('frozen', decision === 'confirm' || decision === 'reopen' ? decision : '');
    for (const question of this.questions) /** @type {any} */ (question).setFrozen(true);
    this.confirm?.setFrozen(true, decision);
    setPart(this, 'aisf-action-bar', undefined);
  }

  /** Internal. Copies what is on screen into the saved state. */
  collect() {
    const key = String(this.number);
    const previous = this.saved ?? {};
    /** @type {Record<string, any>} */
    const next = { ...previous };
    if (this.questions.length > 0) {
      /** @type {Record<string, unknown>} */
      const answers = {};
      for (const question of this.questions) {
        const answer = /** @type {any} */ (question).answer;
        if (answer !== undefined) {
          const { question: name, ...rest } = answer;
          answers[name] = rest;
        }
      }
      next['answers'] = answers;
    }
    if (this.confirm !== null) Object.assign(next, this.confirm.draft);
    this.session.state.rounds[key] = next;
  }

  onChange = () => {
    this.collect();
    this.session.scheduleSave();
    this.refresh();
  };

  onAcceptAll = () => {
    for (const question of this.questions) {
      if (!(/** @type {any} */ (question).isAnswered))
        /** @type {any} */ (question).acceptSuggestion();
    }
    this.onChange();
  };

  /** @param {Event} event */
  onDecide = (event) => {
    const decision = /** @type {CustomEvent<{ decision: 'confirm' | 'reopen' }>} */ (event).detail
      .decision;
    this.collect();
    const { note, hitl } = this.confirm.draft;
    const payload = note.trim() === '' ? { hitl } : { note, hitl };
    void this.send(decision, payload);
  };

  onSubmit = () => {
    if (!this.questions.every((question) => /** @type {any} */ (question).isAnswered)) return;
    this.collect();
    const answers = this.questions.map((question) => /** @type {any} */ (question).answer);
    void this.send('submit', { answers });
  };

  /**
   * Internal. Sends the round's one event and reacts to the answer.
   * @param {'submit' | 'confirm' | 'reopen'} kind
   * @param {unknown} payload
   */
  async send(kind, payload) {
    if (this.locked) return;
    this.sendBusy = false;
    this.setAttribute('saving', '');
    this.refresh();
    let result;
    try {
      result = await this.session.send({ kind, round: this.number, payload });
    } finally {
      this.removeAttribute('saving');
    }
    if (result?.ok === true) {
      this.session.state.rounds[String(this.number)] = { ...this.saved, submitted: kind };
      this.freeze(kind);
      await this.session.saveNow();
    } else if (result?.status === 'busy') {
      this.sendBusy = true;
    } else if (result?.status === 'closed') {
      this.session.setStatus('closed');
    }
    this.refresh();
  }

  /** @returns {boolean} whether the human can no longer change this round */
  get locked() {
    return this.hasAttribute('frozen') || this.hasAttribute('saving') || this.status === 'closed';
  }

  /** Internal. Brings the controls, count and notices in line with the state. */
  refresh() {
    if (this.status === 'open' && this.lastStatus !== 'open') this.sendBusy = false;
    this.lastStatus = this.status;
    const locked = this.locked;
    for (const question of this.questions) /** @type {any} */ (question).setLocked(locked);
    this.confirm?.setLocked(locked);
    this.renderBar(locked);
    const closed = this.status === 'closed';
    const busy = this.status === 'busy' || this.sendBusy;
    const unsaved = this.session.draftNotSaved || this.hasAttribute('draft-not-saved');
    setPart(
      this,
      'aisf-notice-closed',
      closed
        ? buildElement('p', 'aisf-notice aisf-notice-closed', 'This page is closed.')
        : undefined,
      'start',
    );
    setPart(
      this,
      'aisf-notice-busy',
      busy && !closed
        ? buildElement(
            'p',
            'aisf-notice aisf-notice-busy',
            'The session is busy. Your answers are kept; try again in a moment.',
          )
        : undefined,
      'start',
    );
    setPart(
      this,
      'aisf-notice-unsaved',
      unsaved ? buildElement('p', 'aisf-notice aisf-notice-unsaved', 'Draft not saved') : undefined,
      'start',
    );
  }

  /** @param {boolean} locked */
  renderBar(locked) {
    const questions = this.questions;
    if (questions.length === 0 || this.hasAttribute('frozen')) return;
    let bar = this.querySelector('.aisf-action-bar');
    if (bar === null) {
      bar = buildElement('div', 'aisf-action-bar');
      const accept = buildElement('button', 'aisf-accept-all', 'Accept all remaining');
      const submit = buildElement('button', 'aisf-submit', 'Submit');
      accept.type = 'button';
      submit.type = 'button';
      accept.addEventListener('click', this.onAcceptAll);
      submit.addEventListener('click', this.onSubmit);
      bar.append(buildElement('span', 'aisf-answered-count'), accept, submit);
      this.append(bar);
    }
    const answered = questions.filter(
      (question) => /** @type {any} */ (question).isAnswered,
    ).length;
    /** @type {HTMLElement} */ (bar.querySelector('.aisf-answered-count')).textContent =
      `${answered} of ${questions.length}`;
    /** @type {HTMLButtonElement} */ (bar.querySelector('.aisf-accept-all')).disabled = locked;
    /** @type {HTMLButtonElement} */ (bar.querySelector('.aisf-submit')).disabled =
      locked || answered < questions.length;
  }
}
