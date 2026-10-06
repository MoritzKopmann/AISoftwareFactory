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

  /** @param {StatusEvent} event */
  function showStatus(event) {
    document.documentElement.setAttribute('data-aisf-status', event.status);
    if (document.body === null) {
      document.addEventListener('DOMContentLoaded', () => showStatus(event), { once: true });
      return;
    }
    document.body.toggleAttribute('inert', event.status === 'closed');
  }

  /** @param {StatusEvent} event */
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
    async load() {
      const response = await fetch('./_state');
      if (!response.ok) {
        throw new Error(`Loading the draft failed: ${response.status}`);
      }
      return response.json();
    },
    /** @param {unknown} value */
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
