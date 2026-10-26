// The board page's one state store. The canvas and the feedback panel both read it.
import { isRecord } from '../support/dom.js';
import { pageSession } from '../support/page-session.js';

/** @typedef {{ id: string, title: string, w: number, h: number, note: string }} Board */
/** @typedef {{ title: string, brief: string, round: number, boards: Board[] }} BoardIndex */
/** @typedef {{ n: number, board: string, theme: string, x: number, y: number, text: string }} Pin */
/** @typedef {Pin & { round: number }} EarlierPin */
/**
 * The fields saved through `pageSession()` under `state.board`.
 * @typedef {object} BoardDraft
 * @property {Pin[]} pins this round
 * @property {string} message
 * @property {EarlierPin[]} earlier
 * @property {string[]} updated board ids changed since the last feedback
 * @property {number | null} sentRound
 * @property {number | null} acceptedRound
 */
/**
 * @typedef {BoardDraft & {
 *   index: BoardIndex | undefined | 'missing',
 *   status: import('../support/page-session.js').PageStatus,
 *   zoom: number | null,
 *   commenting: boolean,
 *   confirming: boolean,
 *   refused: null | 'busy' | 'closed' | 'failed',
 * }} BoardState
 */
/** @typedef {'loading' | 'missing' | 'accepted' | 'revising' | 'yourTurn'} BoardMode */
/**
 * @typedef {object} BoardStoreDependencies
 * @property {import('../support/page-session.js').PageSession} session
 * @property {(url: string) => Promise<Response>} fetch
 * @property {(url: string) => EventTarget} openChanges
 */

/** @type {ReadonlyArray<keyof BoardDraft>} */
const draftKeys = ['pins', 'message', 'earlier', 'updated', 'sentRound', 'acceptedRound'];
const NOT_FOUND_STATUS = 404;
const BOARD_FILE_PATTERN = /^boards\/(.+)\.html$/;

/** @type {BoardStore | undefined} */
let store;

/** @returns {BoardStore} the page's store, created on first use. Call `start()` once. */
export function boardStore() {
  store ??= new BoardStore({
    session: pageSession(),
    fetch: (url) => fetch(url),
    openChanges: (url) => new EventSource(url),
  });
  return store;
}

export class BoardStore {
  /** @param {BoardStoreDependencies} dependencies */
  constructor(dependencies) {
    this.dependencies = dependencies;
    /** @type {BoardState} */
    this.state = {
      index: undefined,
      status: dependencies.session.status,
      zoom: null,
      commenting: false,
      confirming: false,
      refused: null,
      ...buildEmptyDraft(),
    };
    /** @type {Set<() => void>} */
    this.listeners = new Set();
    /** @type {Set<(boardId: string) => void>} */
    this.boardReloadListeners = new Set();
    dependencies.session.subscribe(() => {
      if (dependencies.session.status !== this.state.status) {
        this.merge({ status: dependencies.session.status });
      }
    });
  }

  /** @returns {BoardState} */
  get() {
    return this.state;
  }

  /**
   * Merges `patch` into the state and tells every subscriber. Saves the draft when `patch`
   * changes one of its fields.
   * @param {Partial<BoardState>} patch
   */
  update(patch) {
    this.merge(patch);
    if (draftKeys.some((key) => key in patch)) this.saveDraft();
  }

  /**
   * @param {() => void} listener called after every change
   * @returns {() => void} unsubscribe
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * @param {(boardId: string) => void} listener called each time a board's file changes
   * @returns {() => void} unsubscribe
   */
  onBoardReload(listener) {
    this.boardReloadListeners.add(listener);
    return () => this.boardReloadListeners.delete(listener);
  }

  /** @returns {boolean} whether the human may comment, send or accept */
  get isInputOn() {
    return this.mode === 'yourTurn' && this.state.status !== 'closed';
  }

  /** @returns {BoardMode} first match wins */
  get mode() {
    const { index, acceptedRound, sentRound } = this.state;
    if (index === undefined) return 'loading';
    if (index === 'missing') return 'missing';
    if (acceptedRound !== null) return 'accepted';
    if (isAwaitingRevision(index, sentRound)) return 'revising';
    return 'yourTurn';
  }

  /** Loads the index, then the draft, then follows changes to the design folder. */
  async start() {
    const index = await this.readIndex();
    await this.dependencies.session.ready;
    this.merge({ index, ...readDraft(this.dependencies.session.state['board']) });
    this.riseRound();
    this.followChanges();
  }

  /**
   * Internal: merges without saving.
   * @param {Partial<BoardState>} patch
   */
  merge(patch) {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  /** Internal: hands the draft fields to the page session, which saves them shortly. */
  saveDraft() {
    const { session } = this.dependencies;
    session.state['board'] = Object.fromEntries(draftKeys.map((key) => [key, this.state[key]]));
    session.scheduleSave();
  }

  /**
   * Internal.
   * @returns {Promise<BoardIndex | 'missing'>}
   */
  async readIndex() {
    const response = await this.dependencies.fetch('./index.json');
    if (response.status === NOT_FOUND_STATUS) return 'missing';
    return /** @type {BoardIndex} */ (await response.json());
  }

  /** Internal: once a new round is out, this round's pins become earlier ones. */
  riseRound() {
    const overtakenRound = findOvertakenSentRound(this.state);
    if (overtakenRound === undefined) return;
    const { pins, earlier } = this.state;
    this.update({
      earlier: [...earlier, ...pins.map((pin) => ({ ...pin, round: overtakenRound }))],
      pins: [],
      message: '',
      sentRound: null,
    });
  }

  /** Internal: listens for `reload` events on the design folder. */
  followChanges() {
    this.dependencies.openChanges('./_changes').addEventListener('reload', (event) => {
      const { data } = /** @type {MessageEvent<string>} */ (event);
      void this.handleFileChange(String(JSON.parse(data).file));
    });
  }

  /**
   * Internal: one changed file in the design folder.
   * @param {string} file relative to the folder, e.g. `boards/settings.html`
   */
  async handleFileChange(file) {
    if (file === 'index.json') {
      this.merge({ index: await this.readIndex() });
      this.riseRound();
      return;
    }
    const boardId = BOARD_FILE_PATTERN.exec(file)?.[1];
    if (boardId === undefined) return;
    this.markUpdated(boardId);
    for (const listener of [...this.boardReloadListeners]) listener(boardId);
  }

  /**
   * Internal.
   * @param {string} boardId
   */
  markUpdated(boardId) {
    if (this.state.updated.includes(boardId)) return;
    this.update({ updated: [...this.state.updated, boardId] });
  }
}

/** @returns {BoardDraft} */
function buildEmptyDraft() {
  return { pins: [], message: '', earlier: [], updated: [], sentRound: null, acceptedRound: null };
}

/**
 * @param {BoardIndex} index
 * @param {number | null} sentRound
 * @returns {boolean} whether feedback went out for this round and the session has not answered yet
 */
function isAwaitingRevision(index, sentRound) {
  return sentRound !== null && index.round <= sentRound;
}

/**
 * Reads a saved draft field by field; a field of the wrong type falls back to empty.
 * @param {unknown} saved
 * @returns {BoardDraft}
 */
function readDraft(saved) {
  const draft = buildEmptyDraft();
  if (!isRecord(saved)) return draft;
  return {
    pins: Array.isArray(saved['pins']) ? saved['pins'] : draft.pins,
    message: typeof saved['message'] === 'string' ? saved['message'] : draft.message,
    earlier: Array.isArray(saved['earlier']) ? saved['earlier'] : draft.earlier,
    updated: Array.isArray(saved['updated']) ? saved['updated'] : draft.updated,
    sentRound: readRound(saved['sentRound']),
    acceptedRound: readRound(saved['acceptedRound']),
  };
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function readRound(value) {
  return typeof value === 'number' ? value : null;
}

/**
 * @param {BoardState} state
 * @returns {number | undefined} the round feedback was sent in, once the index is past it
 */
function findOvertakenSentRound({ index, sentRound }) {
  if (typeof index !== 'object' || sentRound === null) return undefined;
  return index.round > sentRound ? sentRound : undefined;
}
