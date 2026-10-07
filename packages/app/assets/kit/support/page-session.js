// The page's one link to bridge.js: the saved user input state, the status and the sends.
// Elements share it. Without an `aisf` global it saves and sends nothing.
import { isRecord } from './dom.js';

/** @typedef {'open' | 'busy' | 'closed'} PageStatus */
/** @typedef {{ kind: 'submit' | 'confirm' | 'reopen', round: number, payload: unknown }} PageEvent */
/** @typedef {{ ok: true } | { ok: false, status: 'busy' | 'closed' }} SendResult */
/**
 * @typedef {object} Aisf
 * @property {{ load(): Promise<unknown>, save(value: unknown): Promise<void> }} userInputState
 * @property {(event: 'status', listener: (event: { status: PageStatus, version: number }) => void) => void} on
 * @property {(event: PageEvent) => Promise<SendResult>} send
 */

const saveDelayMilliseconds = 500;

/** @returns {PageStatus} */
function statusFromRoot() {
  const value = document.documentElement.getAttribute('data-aisf-status');
  return value === 'busy' || value === 'closed' ? value : 'open';
}

export class PageSession {
  /** @param {Aisf | undefined} aisf */
  constructor(aisf) {
    this.aisf = aisf;
    /** @type {PageStatus} */
    this.status = statusFromRoot();
    this.draftNotSaved = false;
    /** @type {Record<string, unknown> & { rounds: Record<string, unknown> }} */
    this.state = { rounds: {} };
    /** @type {Set<() => void>} */
    this.listeners = new Set();
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this.saveTimer = undefined;
    this.ready = this.load();
    aisf?.on('status', (event) => this.setStatus(event.status));
  }

  /** Internal, started by the constructor. Loads the saved state once. */
  async load() {
    if (this.aisf === undefined) return;
    try {
      const loaded = await this.aisf.userInputState.load();
      if (isRecord(loaded)) {
        this.state = { ...loaded, rounds: isRecord(loaded['rounds']) ? loaded['rounds'] : {} };
      }
    } catch {
      // No readable draft: start empty.
    }
  }

  /**
   * For elements: calls `listener` on every status or save-notice change.
   * @param {() => void} listener
   * @returns {() => void} unsubscribe
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of [...this.listeners]) listener();
  }

  /** @param {PageStatus} status */
  setStatus(status) {
    if (status === this.status) return;
    this.status = status;
    this.notify();
  }

  /** For elements: saves the draft after the human stops changing it. */
  scheduleSave() {
    if (this.aisf === undefined) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.saveNow(), saveDelayMilliseconds);
  }

  /** For elements: saves the draft now. Never rejects: a failure sets `draftNotSaved`. */
  async saveNow() {
    if (this.aisf === undefined) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    try {
      await this.aisf.userInputState.save(this.state);
      this.draftNotSaved = false;
    } catch {
      this.draftNotSaved = true;
    }
    this.notify();
  }

  /**
   * For rounds: sends one event. Resolves `undefined` when there is no bridge.
   * @param {PageEvent} event
   * @returns {Promise<SendResult | undefined>}
   */
  async send(event) {
    return this.aisf?.send(event);
  }

  /** Internal, for tests: stops a pending save. */
  dispose() {
    clearTimeout(this.saveTimer);
    this.listeners.clear();
  }
}

/** @type {PageSession | undefined} */
let session;

/** @returns {PageSession} the page's session, created on first use from `window.aisf` */
export function pageSession() {
  session ??= new PageSession(/** @type {Aisf | undefined} */ (/** @type {any} */ (window).aisf));
  return session;
}

/** For tests: forgets the session so the next `pageSession()` reads `window.aisf` anew. */
export function resetPageSession() {
  session?.dispose();
  session = undefined;
}
