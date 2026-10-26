// The board page's feedback panel: brief, pins, whole-design comment, Send and Accept.
import { buildElement } from '../support/dom.js';
import { pageSession } from '../support/page-session.js';
import { boardStore } from './board-store.js';

/** @typedef {import('./board-store.js').BoardStore} BoardStore */
/** @typedef {import('./board-store.js').BoardState} BoardState */
/** @typedef {import('./board-store.js').BoardIndex} BoardIndex */
/** @typedef {import('./board-store.js').BoardMode} BoardMode */
/** @typedef {import('./board-store.js').Pin} Pin */
/** @typedef {import('./board-store.js').EarlierPin} EarlierPin */
/** @typedef {import('./board-store.js').EarlierMessage} EarlierMessage */
/** @typedef {import('../support/page-session.js').PageSession} PageSession */
/** @typedef {import('../support/page-session.js').SendResult} SendResult */
/** @typedef {(pin: Pin, where: string) => HTMLElement} PinRowBuilder */
/**
 * @typedef {object} PanelParts
 * @property {HTMLElement} brief
 * @property {HTMLElement} heading
 * @property {HTMLButtonElement} toggle
 * @property {HTMLElement} list
 * @property {HTMLTextAreaElement} message
 * @property {HTMLElement} refusal
 * @property {HTMLElement} confirm
 * @property {HTMLElement} unsent
 * @property {HTMLButtonElement} confirmAccept
 * @property {HTMLButtonElement} confirmCancel
 * @property {HTMLButtonElement} send
 * @property {HTMLButtonElement} accept
 */

/** @type {Record<NonNullable<BoardState['refused']>, string>} */
const REFUSAL_TEXT = {
  busy: 'Not sent: the session is busy. Try again in a moment.',
  closed: 'Not sent: this page is closed.',
  failed: 'Not sent: the app did not answer. Try again.',
};

const panelSlot = document.querySelector('#board-panel');
if (panelSlot instanceof HTMLElement) mountBoardPanel(panelSlot, boardStore(), pageSession());

/**
 * Builds the panel into `host` and keeps it in step with the store.
 * @param {HTMLElement} host the page's `<aside id="board-panel">`
 * @param {BoardStore} store
 * @param {PageSession} session sends the feedback and accept events
 */
export function mountBoardPanel(host, store, session) {
  const parts = buildPanel(host);
  listenToControls(parts, store, session);
  host.ownerDocument.addEventListener('keydown', (event) => toggleCommentingByKey(store, event));
  clearRefusalOnNextPin(store);
  const render = createRenderer(parts, store);
  store.subscribe(render);
  render();
}

/**
 * @param {HTMLElement} host
 * @returns {PanelParts}
 */
function buildPanel(host) {
  const brief = buildElement('p', 'board-brief-text');
  const briefSection = buildSection('board-brief', [
    buildElement('h2', 'board-h2', 'Brief'),
    brief,
  ]);

  const heading = buildElement('h2', 'board-h2 board-pins-heading');
  const toggle = buildToggle();
  const list = buildPinList();
  const pinsSection = buildSection('board-pins', [
    buildSection('board-pins-head', [heading, toggle], 'div'),
    list,
  ]);

  const message = buildMessageField();
  const messageLabel = buildElement('label', 'board-message-label', 'Comment on the whole design');
  messageLabel.htmlFor = message.id;
  const messageSection = buildSection('board-whole', [messageLabel, message]);

  const refusal = buildRefusal();
  const unsent = buildElement('p', 'board-unsent');
  const confirmAccept = buildButton('board-confirm-accept', 'Accept design');
  const confirmCancel = buildButton('board-confirm-cancel', 'Cancel');
  const confirm = buildConfirm([unsent, confirmAccept, confirmCancel]);
  const send = buildButton('board-button board-send');
  const accept = buildButton('board-button board-accept', 'Accept design…');
  const buttons = buildSection('board-buttons', [send, accept], 'div');
  const actionBar = buildSection('board-actions', [refusal, confirm, buttons], 'div');

  host.replaceChildren(briefSection, pinsSection, messageSection, actionBar);
  return {
    brief,
    heading,
    toggle,
    list,
    message,
    refusal,
    confirm,
    unsent,
    confirmAccept,
    confirmCancel,
    send,
    accept,
  };
}

/** @returns {HTMLButtonElement} */
function buildToggle() {
  const toggle = buildButton('board-toggle', 'Comment on a spot ');
  toggle.setAttribute('aria-keyshortcuts', 'C');
  toggle.append(buildElement('kbd', '', 'C'));
  return toggle;
}

/** @returns {HTMLElement} */
function buildPinList() {
  const list = buildElement('div', 'board-pin-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Comments');
  list.tabIndex = 0;
  return list;
}

/** @returns {HTMLTextAreaElement} */
function buildMessageField() {
  const message = buildElement('textarea', 'board-field board-message');
  message.id = 'board-message';
  message.rows = 3;
  message.placeholder = 'Broad changes, not tied to one spot…';
  return message;
}

/** @returns {HTMLElement} */
function buildRefusal() {
  const refusal = buildElement('p', 'board-refusal');
  refusal.setAttribute('role', 'alert');
  return refusal;
}

/**
 * @param {[HTMLElement, HTMLButtonElement, HTMLButtonElement]} children the dropped-comments
 *   warning, then Accept design and Cancel
 * @returns {HTMLElement}
 */
function buildConfirm([unsent, confirmAccept, confirmCancel]) {
  const confirm = buildElement('div', 'board-confirm');
  confirm.setAttribute('role', 'group');
  confirm.setAttribute('aria-label', 'Accept design');
  const question = buildElement('p', '');
  question.append(
    'Accept this design? The ticket gets ',
    buildElement('code', '', '## Design'),
    ' and moves to ',
    buildElement('code', '', 'status: plan'),
    '.',
  );
  const actions = buildElement('div', 'board-confirm-actions');
  actions.append(confirmAccept, confirmCancel);
  confirm.append(question, unsent, actions);
  return confirm;
}

/**
 * @param {string} className
 * @param {HTMLElement[]} children
 * @param {'section' | 'div'} [tag]
 * @returns {HTMLElement}
 */
function buildSection(className, children, tag = 'section') {
  const section = buildElement(tag, className);
  section.append(...children);
  return section;
}

/**
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLButtonElement}
 */
function buildButton(className, text) {
  const button = buildElement('button', className, text);
  button.type = 'button';
  return button;
}

/**
 * @param {PanelParts} parts
 * @param {BoardStore} store
 * @param {PageSession} session
 */
function listenToControls(parts, store, session) {
  parts.toggle.addEventListener('click', () => toggleCommenting(store));
  parts.message.addEventListener('input', () => store.update({ message: parts.message.value }));
  parts.list.addEventListener('input', (event) => editPinText(store, event.target));
  parts.list.addEventListener('click', (event) => removeClickedPin(store, event.target));
  parts.send.addEventListener('click', () => void sendFeedback(store, session));
  parts.accept.addEventListener('click', () => void startAccept(store, session));
  parts.confirmAccept.addEventListener('click', () => void acceptDesign(store, session));
  parts.confirmCancel.addEventListener('click', () => store.update({ confirming: false }));
}

/**
 * Clears a shown refusal as soon as the store holds more pins than before.
 * @param {BoardStore} store
 */
function clearRefusalOnNextPin(store) {
  let pinCount = store.get().pins.length;
  store.subscribe(() => {
    const { pins, refused } = store.get();
    const isRefusalOutdated = refused !== null && pins.length > pinCount;
    pinCount = pins.length;
    if (isRefusalOutdated) store.update({ refused: null });
  });
}

/**
 * @param {PanelParts} parts
 * @param {BoardStore} store
 * @returns {() => void} draws the panel from the store
 */
function createRenderer(parts, store) {
  let listKey = '';
  return () => {
    const state = store.get();
    const { index } = state;
    if (typeof index !== 'object') return;
    const isInputOn = store.isInputOn;
    const nextListKey = describeListKey(state, index, isInputOn);
    if (nextListKey !== listKey) {
      listKey = nextListKey;
      const buildRow = isInputOn ? buildEditablePinRow : buildReadOnlyPinRow;
      fillList(parts.list, {
        index,
        pins: state.pins,
        earlier: state.earlier,
        earlierMessages: state.earlierMessages,
        buildRow,
      });
    } else {
      syncPinTexts(parts.list, state.pins);
    }
    fillParts(parts, { state, index, isInputOn, mode: store.mode });
  };
}

/**
 * What the list rows depend on, except the comment texts, which update in place.
 * @param {BoardState} state
 * @param {BoardIndex} index
 * @param {boolean} isInputOn
 * @returns {string}
 */
function describeListKey(state, index, isInputOn) {
  const pins = state.pins.map((pin) => [pin.n, pin.board, pin.theme, pin.x, pin.y]);
  const titles = index.boards.map((board) => [board.id, board.title]);
  return JSON.stringify({
    pins,
    earlier: state.earlier,
    earlierMessages: state.earlierMessages,
    isInputOn,
    titles,
  });
}

/**
 * @param {HTMLElement} list
 * @param {{ index: BoardIndex, pins: Pin[], earlier: EarlierPin[], earlierMessages: EarlierMessage[], buildRow: PinRowBuilder }} content
 */
function fillList(list, { index, pins, earlier, earlierMessages, buildRow }) {
  /** @type {HTMLElement[]} */
  const children = pins.map((pin) => buildRow(pin, describeWhere(index, pin)));
  if (pins.length === 0) children.push(buildElement('p', 'board-pins-empty', 'No pins yet.'));
  if (earlier.length + earlierMessages.length > 0) {
    children.push(buildElement('h3', 'board-earlier-heading', 'Earlier rounds'));
    for (const pin of earlier) {
      children.push(
        buildEarlierRow(pin, `Round ${pin.round} · ${describeWhere(index, pin)} · Done`),
      );
    }
    for (const { round, text } of earlierMessages) {
      children.push(buildEarlierMessageRow(`Round ${round} · Whole design`, text));
    }
  }
  list.replaceChildren(...children);
}

/** @type {PinRowBuilder} */
function buildEditablePinRow(pin, where) {
  const label = buildElement('label', 'board-pin-label');
  const field = buildElement('textarea', 'board-field board-pin-text');
  field.rows = 2;
  field.placeholder = 'Write a comment…';
  field.value = pin.text;
  label.append(buildElement('span', 'board-visually-hidden', `Comment ${pin.n}`), field);
  const remove = buildButton('board-pin-remove', 'Remove');
  remove.setAttribute('aria-label', `Remove pin ${pin.n}`);
  const row = buildPinRow(pin, where, label);
  row.append(remove);
  return row;
}

/** @type {PinRowBuilder} */
function buildReadOnlyPinRow(pin, where) {
  return buildPinRow(pin, where, buildElement('p', 'board-pin-read', pin.text));
}

/**
 * @param {Pin} pin
 * @param {string} where
 * @param {HTMLElement} comment the field or the read-only text
 * @returns {HTMLElement}
 */
function buildPinRow(pin, where, comment) {
  const row = buildElement('div', 'board-pin');
  row.setAttribute('role', 'listitem');
  row.dataset['n'] = String(pin.n);
  const body = buildElement('div', 'board-pin-body');
  body.append(buildElement('span', 'board-pin-where', where), comment);
  row.append(buildElement('span', 'board-pin-badge', String(pin.n)), body);
  return row;
}

/**
 * @param {EarlierPin} pin
 * @param {string} where
 * @returns {HTMLElement}
 */
function buildEarlierRow(pin, where) {
  const row = buildElement('div', 'board-pin board-pin-earlier');
  row.setAttribute('role', 'listitem');
  const body = buildElement('div', 'board-pin-body');
  body.append(
    buildElement('span', 'board-pin-where', where),
    buildElement('p', 'board-pin-read', pin.text),
  );
  row.append(buildElement('span', 'board-pin-badge', String(pin.n)), body);
  return row;
}

/**
 * @param {string} where
 * @param {string} text
 * @returns {HTMLElement}
 */
function buildEarlierMessageRow(where, text) {
  const row = buildElement('div', 'board-pin board-pin-earlier');
  row.setAttribute('role', 'listitem');
  const body = buildElement('div', 'board-pin-body');
  body.append(
    buildElement('span', 'board-pin-where', where),
    buildElement('p', 'board-pin-read', text),
  );
  row.append(body);
  return row;
}

/**
 * Writes the store's texts into the pin fields the human is not typing in.
 * @param {HTMLElement} list
 * @param {Pin[]} pins
 */
function syncPinTexts(list, pins) {
  for (const pin of pins) {
    const field = list.querySelector(`.board-pin[data-n="${pin.n}"] textarea`);
    if (isOutdatedField(field, pin.text)) field.value = pin.text;
  }
}

/**
 * @param {Element | null} field
 * @param {string} text the store's text for the field
 * @returns {field is HTMLTextAreaElement}
 */
function isOutdatedField(field, text) {
  return field instanceof HTMLTextAreaElement && field.value !== text;
}

/**
 * @param {PanelParts} parts
 * @param {{ state: BoardState, index: BoardIndex, isInputOn: boolean, mode: BoardMode }} view
 */
function fillParts(parts, { state, index, isInputOn, mode }) {
  parts.brief.textContent = index.brief;
  parts.heading.textContent = describeHeading(state.pins.length, mode);
  parts.toggle.disabled = !isInputOn;
  parts.toggle.setAttribute('aria-pressed', String(state.commenting));
  if (parts.message.value !== state.message) parts.message.value = state.message;
  parts.message.disabled = !isInputOn;
  parts.refusal.hidden = state.refused === null;
  parts.refusal.textContent = state.refused === null ? '' : REFUSAL_TEXT[state.refused];
  parts.confirm.hidden = !state.confirming;
  const unsentCount = countUnsent(state);
  parts.unsent.hidden = unsentCount === 0;
  parts.unsent.textContent = describeUnsent(unsentCount);
  parts.send.textContent = `Send feedback (${state.pins.length} pinned)`;
  parts.send.disabled = !isInputOn || unsentCount === 0;
  parts.accept.textContent = unsentCount === 0 ? 'Accept design' : 'Accept design…';
  parts.accept.hidden = mode === 'accepted';
  parts.accept.disabled = !isInputOn || state.confirming;
}

/**
 * @param {number} pinCount
 * @param {BoardMode} mode
 * @returns {string}
 */
export function describeHeading(pinCount, mode) {
  if (mode === 'revising') return 'This round · sent';
  return `This round · ${pinCount} pinned`;
}

/**
 * @param {BoardIndex} index
 * @param {Pin} pin
 * @returns {string} e.g. `Default · light · 212, 148`
 */
function describeWhere(index, pin) {
  const title = index.boards.find((board) => board.id === pin.board)?.title ?? pin.board;
  return `${title} · ${pin.theme} · ${pin.x}, ${pin.y}`;
}

/**
 * @param {{ pins: Pin[], message: string }} draft
 * @returns {number} the pins plus one for a non-empty message
 */
export function countUnsent({ pins, message }) {
  return pins.length + (message.trim() === '' ? 0 : 1);
}

/**
 * @param {number} count
 * @returns {string}
 */
export function describeUnsent(count) {
  if (count === 1) return 'Your 1 unsent comment is dropped.';
  return `Your ${count} unsent comments are dropped.`;
}

/** @param {BoardStore} store */
function toggleCommenting(store) {
  if (store.isInputOn) store.update({ commenting: !store.get().commenting });
}

/**
 * @param {BoardStore} store
 * @param {KeyboardEvent} event
 */
function toggleCommentingByKey(store, event) {
  if (isCommentShortcut(event)) toggleCommenting(store);
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean} whether it is a bare C pressed outside a text field
 */
function isCommentShortcut(event) {
  return isCommentKey(event) && !hasModifier(event) && !isTextField(event.target);
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
function isCommentKey(event) {
  return event.key === 'c' || event.key === 'C';
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
function hasModifier(event) {
  return event.ctrlKey || event.metaKey || event.altKey;
}

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function isTextField(target) {
  return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
}

/**
 * @param {BoardStore} store
 * @param {EventTarget | null} target
 */
function editPinText(store, target) {
  if (!(target instanceof HTMLTextAreaElement)) return;
  const pinNumber = readPinNumber(target);
  const pins = store
    .get()
    .pins.map((pin) => (pin.n === pinNumber ? { ...pin, text: target.value } : pin));
  store.update({ pins });
}

/**
 * @param {BoardStore} store
 * @param {EventTarget | null} target
 */
function removeClickedPin(store, target) {
  if (!isRemoveButton(target)) return;
  store.update({ pins: renumberWithoutPin(store.get().pins, readPinNumber(target)) });
}

/**
 * @param {EventTarget | null} target
 * @returns {target is HTMLElement}
 */
function isRemoveButton(target) {
  return target instanceof HTMLElement && target.classList.contains('board-pin-remove');
}

/**
 * @param {Element} element inside a pin row
 * @returns {number} the row's pin number
 */
function readPinNumber(element) {
  return Number(element.closest('.board-pin')?.getAttribute('data-n'));
}

/**
 * @param {Pin[]} pins
 * @param {number} pinNumber
 * @returns {Pin[]} the other pins, numbered from 1
 */
function renumberWithoutPin(pins, pinNumber) {
  return pins
    .filter((pin) => pin.n !== pinNumber)
    .map((pin, position) => ({ ...pin, n: position + 1 }));
}

/**
 * @param {BoardStore} store
 * @param {PageSession} session
 */
async function sendFeedback(store, session) {
  const { index, pins, message } = store.get();
  if (typeof index !== 'object') return;
  const comments = pins.map((pin) => ({
    n: pin.n,
    board: pin.board,
    theme: pin.theme,
    x: pin.x,
    y: pin.y,
    text: pin.text,
  }));
  const payload = { round: index.round, comments, message };
  // Saved before the POST: the answer lets the ticket page remove this board before the
  // debounced save would run.
  store.update({ sentRound: index.round });
  await session.saveNow();
  await deliver(
    store,
    session,
    () => session.send({ kind: 'design-feedback', round: index.round, payload }),
    { updated: [] },
    async () => {
      store.update({ sentRound: null });
      await session.saveNow();
    },
  );
}

/**
 * Accepts at once when nothing is unsent, otherwise asks to drop the unsent comments.
 * @param {BoardStore} store
 * @param {PageSession} session
 */
async function startAccept(store, session) {
  if (countUnsent(store.get()) === 0) {
    await acceptDesign(store, session);
    return;
  }
  store.update({ confirming: true, refused: null });
}

/**
 * @param {BoardStore} store
 * @param {PageSession} session
 */
async function acceptDesign(store, session) {
  const { index } = store.get();
  if (typeof index !== 'object') return;
  const payload = { round: index.round };
  await deliver(
    store,
    session,
    () => session.send({ kind: 'design-accepted', round: index.round, payload }),
    {
      acceptedRound: index.round,
      pins: [],
      message: '',
    },
  );
}

/**
 * Sends one event. Applies `deliveredPatch` once it is delivered, otherwise records the refusal.
 * @param {BoardStore} store
 * @param {PageSession} session
 * @param {() => Promise<SendResult | undefined>} send
 * @param {Partial<BoardState>} deliveredPatch
 * @param {() => Promise<void>} [undo] runs first when the send is refused
 */
async function deliver(store, session, send, deliveredPatch, undo) {
  store.update({ refused: null });
  const refused = await sendForRefusal(send);
  if (refused === null) {
    store.update({ ...deliveredPatch, commenting: false, confirming: false });
    // The ticket page may remove this page at once; a delayed save would be lost.
    await session.saveNow();
    return;
  }
  await undo?.();
  store.update({ refused });
}

/**
 * @param {() => Promise<SendResult | undefined>} send
 * @returns {Promise<BoardState['refused']>} `null` once delivered
 */
async function sendForRefusal(send) {
  /** @type {SendResult | undefined} */
  let result;
  try {
    result = await send();
  } catch {
    // Never-crash boundary: the bridge rejects with a plain Error on a network failure or an
    // unexpected status, and every rejection reads as "the app did not answer".
    return 'failed';
  }
  return readRefusal(result);
}

/**
 * @param {SendResult | undefined} result
 * @returns {BoardState['refused']} `null` when delivered; no bridge counts as failed
 */
function readRefusal(result) {
  if (result?.ok === true) return null;
  return result?.status ?? 'failed';
}
