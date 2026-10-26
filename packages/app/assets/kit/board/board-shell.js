// The board page's frame: header, closed banner, loading and missing states. Entry of board.html.
import { boardStore } from './board-store.js';

/** @typedef {import('./board-store.js').BoardStore} BoardStore */
/** @typedef {import('./board-store.js').BoardState} BoardState */
/** @typedef {import('./board-store.js').BoardMode} BoardMode */
/** @typedef {import('../support/page-session.js').PageStatus} PageStatus */
/** @typedef {{ label: string, tone: 'muted' | 'warn' | 'ok' | 'hitl' }} Chip */
/**
 * @typedef {object} ShellParts
 * @property {HTMLElement} title
 * @property {HTMLElement} roundLabel
 * @property {HTMLElement} zoomButton
 * @property {HTMLElement} chip
 * @property {HTMLElement} banner
 * @property {HTMLElement} loadingBlock
 * @property {HTMLElement} missingBlock
 * @property {HTMLElement} body
 */

const DEFAULT_ZOOM = 0.5;

if (isBoardPage()) {
  const store = boardStore();
  mountBoardShell(document, store);
  void store.start();
}

/** @returns {boolean} */
function isBoardPage() {
  return document.querySelector('.board-header') !== null;
}

/**
 * Draws the frame from the store on every change. The canvas and panel slots are left alone.
 * @param {ParentNode} root the page holding board.html's markup
 * @param {BoardStore} store
 */
export function mountBoardShell(root, store) {
  /** @type {ShellParts} */
  const parts = {
    title: findPart(root, '.board-title'),
    roundLabel: findPart(root, '.board-round'),
    zoomButton: findPart(root, '.board-zoom'),
    chip: findPart(root, '.board-chip'),
    banner: findPart(root, '.board-banner'),
    loadingBlock: findPart(root, '.board-loading'),
    missingBlock: findPart(root, '.board-missing'),
    body: findPart(root, '.board-body'),
  };

  parts.zoomButton.addEventListener('click', () => store.update({ zoom: 1 }));

  const render = () => {
    const state = store.get();
    showBlocks(parts, state);
    const { index } = state;
    if (typeof index !== 'object') return;
    fillHeader(parts, { index, zoom: state.zoom, chip: describeChip(state.status, store.mode) });
  };
  store.subscribe(render);
  render();
}

/**
 * @param {ParentNode} root
 * @param {string} selector
 * @returns {HTMLElement}
 */
function findPart(root, selector) {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`board.html lacks ${selector}`);
  return element;
}

/**
 * Shows the parts the state calls for and hides the rest.
 * @param {ShellParts} parts
 * @param {BoardState} state
 */
function showBlocks(parts, { index, status }) {
  const isLoaded = typeof index === 'object';
  if (!isLoaded) parts.title.textContent = 'Design';
  for (const element of [parts.roundLabel, parts.zoomButton, parts.chip, parts.body]) {
    element.hidden = !isLoaded;
  }
  parts.loadingBlock.hidden = index !== undefined;
  parts.missingBlock.hidden = index !== 'missing';
  parts.banner.hidden = status !== 'closed';
}

/**
 * @param {ShellParts} parts
 * @param {{ index: import('./board-store.js').BoardIndex, zoom: number | null, chip: Chip }} header
 */
function fillHeader(parts, { index, zoom, chip }) {
  parts.title.textContent = index.title;
  parts.roundLabel.textContent = `Round ${index.round}`;
  const zoomPercent = Math.round((zoom ?? DEFAULT_ZOOM) * 100);
  parts.zoomButton.textContent = `Zoom ${zoomPercent}%`;
  parts.zoomButton.setAttribute('aria-label', `Zoom ${zoomPercent}%. Reset to 100%.`);
  parts.chip.textContent = chip.label;
  parts.chip.dataset['tone'] = chip.tone;
}

/**
 * The status chip. First match wins: closed, revising, accepted, your turn.
 * @param {PageStatus} status
 * @param {BoardMode} mode
 * @returns {Chip}
 */
export function describeChip(status, mode) {
  if (status === 'closed') return { label: 'Closed', tone: 'muted' };
  if (mode === 'revising') return { label: 'Session is revising…', tone: 'warn' };
  if (mode === 'accepted') return { label: 'Accepted', tone: 'ok' };
  return { label: 'Your turn', tone: 'hitl' };
}
