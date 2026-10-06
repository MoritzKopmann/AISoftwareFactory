// The bridge between an artifact page and the aisf app. Served at /aisf/bridge.js.
// A classic script: it adds one global, `aisf`.
(() => {
  const pollIntervalMilliseconds = 3000;

  /** @typedef {'open' | 'busy' | 'closed'} PageStatus */
  /** @typedef {{ status: PageStatus, version: number }} StatusEvent */

  /** @type {Array<(event: StatusEvent) => void>} */
  const listeners = [];
  /** @type {StatusEvent | undefined} */
  let lastEvent;
  /** @type {number | undefined} */
  let loadedVersion;

  /**
   * Internal, called by `receive`. Marks the page with the status for its CSS
   * (`data-aisf-status`) and makes it inert while closed.
   * @param {StatusEvent} event
   */
  function showStatus(event) {
    document.documentElement.setAttribute('data-aisf-status', event.status);
    if (document.body === null) {
      document.addEventListener('DOMContentLoaded', () => showStatus(event), { once: true });
      return;
    }
    document.body.toggleAttribute('inert', event.status === 'closed');
  }

  /**
   * Internal, called by `poll` with each `_status` answer. Reloads the page on a
   * new version; otherwise shows a changed status and tells the listeners.
   * @param {StatusEvent} event
   */
  function receive(event) {
    if (loadedVersion !== undefined && event.version !== loadedVersion) {
      location.reload();
      return;
    }
    loadedVersion = event.version;
    const changed =
      lastEvent === undefined ||
      lastEvent.status !== event.status ||
      lastEvent.version !== event.version;
    lastEvent = event;
    if (changed) {
      showStatus(event);
      for (const listener of listeners) listener(event);
    }
  }

  /** Internal, started once on load. Asks the app for `_status` every few seconds, forever. */
  async function poll() {
    try {
      const response = await fetch('./_status');
      if (response.ok) {
        receive(/** @type {StatusEvent} */ (await response.json()));
      }
    } catch {
      // The app may be restarting: keep polling.
    }
    setTimeout(poll, pollIntervalMilliseconds);
  }

  const state = {
    /** For page code: loads the saved draft (`null` if none), to restore the page's inputs on open. */
    async load() {
      const response = await fetch('./_state');
      if (!response.ok) {
        throw new Error(`Loading the draft failed: ${response.status}`);
      }
      return response.json();
    },
    /**
     * For page code: saves any JSON value as the draft, so the human's input
     * survives a reload or an app restart.
     * @param {unknown} value
     */
    async save(value) {
      const response = await fetch('./_state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!response.ok) {
        throw new Error(`Saving the draft failed: ${response.status}`);
      }
    },
  };

  /**
   * For page code: registers a listener for status changes, e.g. to show
   * "the session is busy". A late listener gets the current status at once.
   * @param {'status'} event
   * @param {(event: StatusEvent) => void} listener
   */
  function on(event, listener) {
    if (event !== 'status') {
      throw new Error(`Unknown aisf event: ${String(event)}`);
    }
    listeners.push(listener);
    if (lastEvent !== undefined) listener(lastEvent);
  }

  /** @type {any} */ (window).aisf = { state, on };
  void poll();
})();
