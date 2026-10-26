// The board page's canvas: every board in light and dark, scaled by the zoom, with pins.
import { buildElement, setPart } from '../support/dom.js';
import { boardStore } from './board-store.js';

/** @typedef {import('./board-store.js').BoardStore} BoardStore */
/** @typedef {import('./board-store.js').BoardState} BoardState */
/** @typedef {import('./board-store.js').Board} Board */
/** @typedef {import('./board-store.js').Pin} Pin */
/** @typedef {'light' | 'dark'} Theme */
/**
 * One theme's frame of one board.
 * @typedef {object} FramePart
 * @property {Board} board
 * @property {Theme} theme
 * @property {HTMLElement} frame
 * @property {HTMLIFrameElement} document
 * @property {HTMLButtonElement} hit
 */
/**
 * @typedef {object} SectionPart
 * @property {Board} board
 * @property {HTMLElement} element
 * @property {HTMLElement} heading
 * @property {FramePart[]} frames
 */
/**
 * What every section draws the same for one store state.
 * @typedef {object} CanvasView
 * @property {number} zoom
 * @property {boolean} hitEnabled
 * @property {'hitl' | 'muted'} thisRoundTone
 */

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const DEFAULT_ZOOM = 0.5;
const WHEEL_RATE = 0.002;
const KEY_STEP = 1.1;
/** Main's side padding (16 + 16) plus the gap between the two frames (20). */
const FIT_SLACK = 52;
const FRAMES_PER_BOARD = 2;
/** @type {ReadonlyArray<Theme>} */
const THEMES = ['light', 'dark'];
const THEME_LABELS = { light: 'Light', dark: 'Dark' };

const canvasElement = document.getElementById('board-canvas');
if (canvasElement !== null) mountBoardCanvas(document, boardStore());

/**
 * Draws every board into `<main id="board-canvas">` from the store on every change.
 * @param {ParentNode} root the page holding board.html's markup
 * @param {BoardStore} store
 */
export function mountBoardCanvas(root, store) {
  const main = root.querySelector('#board-canvas');
  if (!(main instanceof HTMLElement)) throw new Error('board.html lacks #board-canvas');
  main.tabIndex = 0;
  main.setAttribute('aria-label', 'Boards. Ctrl or Command plus scroll to zoom.');
  listenForZoom(main, store);
  const column = buildElement('div', 'canvas-sections');
  main.append(column);

  /** @type {SectionPart[]} */
  let sections = [];
  let shownBoards = '';
  const render = () => {
    const state = store.get();
    const { index, zoom } = state;
    if (typeof index !== 'object') return;
    if (zoom === null) {
      store.update({ zoom: fitZoom(main.clientWidth, index.boards) });
      return;
    }
    const boardsKey = JSON.stringify(index.boards);
    if (boardsKey !== shownBoards) {
      shownBoards = boardsKey;
      sections = index.boards.map((board, position) => buildSection(board, position, store));
      column.replaceChildren(...sections.map((section) => section.element));
    }
    /** @type {CanvasView} */
    const view = {
      zoom,
      hitEnabled: isHitEnabled(state.commenting, store.isInputOn),
      thisRoundTone: store.mode === 'yourTurn' ? 'hitl' : 'muted',
    };
    for (const section of sections) updateSection(section, state, view);
  };
  store.onBoardReload((boardId) => {
    const section = sections.find((candidate) => candidate.board.id === boardId);
    for (const part of section?.frames ?? []) reloadDocument(part);
  });
  store.subscribe(render);
  render();
}

/**
 * Ctrl/⌘ + wheel and Ctrl/⌘ + plus, equals or minus change the zoom. A plain wheel scrolls.
 * @param {HTMLElement} main
 * @param {BoardStore} store
 */
function listenForZoom(main, store) {
  main.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      store.update({ zoom: wheelZoom(store.get().zoom, event.deltaY) });
    },
    { passive: false },
  );
  main.addEventListener('keydown', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const zoom = keyZoom(store.get().zoom, event.key);
    if (zoom === undefined) return;
    event.preventDefault();
    store.update({ zoom });
  });
}

/**
 * @param {Board} board
 * @param {number} position 0-based
 * @param {BoardStore} store
 * @returns {SectionPart}
 */
function buildSection(board, position, store) {
  const section = buildElement('section', 'canvas-section');
  const heading = buildElement('div', 'canvas-heading');
  heading.append(
    buildElement('span', 'canvas-num', String(position + 1).padStart(2, '0')),
    buildElement('h2', 'canvas-title', board.title),
    buildElement('span', 'canvas-dims', `${board.w} × ${board.h}`),
  );
  const frames = THEMES.map((theme) => buildFrame(board, theme, store));
  const row = buildElement('div', 'canvas-frames');
  for (const part of frames) {
    const wrap = buildElement('div', 'canvas-frame-wrap');
    wrap.append(buildElement('span', 'canvas-frame-label', THEME_LABELS[part.theme]), part.frame);
    row.append(wrap);
  }
  section.append(heading, buildElement('p', 'canvas-note', board.note), row);
  return { board, element: section, heading, frames };
}

/**
 * @param {Board} board
 * @param {Theme} theme
 * @param {BoardStore} store
 * @returns {FramePart}
 */
function buildFrame(board, theme, store) {
  const frame = buildElement('div', 'canvas-frame');
  frame.dataset['board'] = board.id;
  frame.dataset['theme'] = theme;
  const hit = buildElement('button', 'canvas-hit');
  hit.type = 'button';
  hit.setAttribute('aria-label', `Place a pin on ${board.title}, ${theme}`);
  /** @type {FramePart} */
  const part = { board, theme, frame, document: buildDocument(board, theme), hit };
  hit.addEventListener('click', (event) => placePin(part, event, store));
  frame.append(part.document, hit);
  return part;
}

/**
 * @param {Board} board
 * @param {Theme} theme
 * @returns {HTMLIFrameElement} the board's own page, themed on each load
 */
function buildDocument(board, theme) {
  const documentFrame = buildElement('iframe', 'canvas-doc');
  documentFrame.src = `boards/${board.id}.html`;
  documentFrame.title = `${board.title}, ${theme}`;
  documentFrame.style.width = `${board.w}px`;
  documentFrame.style.height = `${board.h}px`;
  documentFrame.addEventListener('load', () => {
    // An empty document has no <html> yet; the board's own load follows.
    documentFrame.contentDocument?.documentElement?.setAttribute('data-theme', theme);
  });
  return documentFrame;
}

/**
 * Swaps in a fresh iframe, so the board's changed file loads.
 * @param {FramePart} part
 */
function reloadDocument(part) {
  const fresh = buildDocument(part.board, part.theme);
  fresh.style.transform = part.document.style.transform;
  part.document.replaceWith(fresh);
  part.document = fresh;
}

/**
 * Appends a pin at the clicked spot, in board pixels.
 * @param {FramePart} part
 * @param {MouseEvent} event
 * @param {BoardStore} store
 */
function placePin({ board, theme, hit }, event, store) {
  if (hit.disabled) return;
  const { pins, zoom } = store.get();
  const rect = hit.getBoundingClientRect();
  const box = { left: rect.left, top: rect.top, width: rect.width, offsetWidth: hit.offsetWidth };
  const point = toBoardPoint(event, box, zoom ?? DEFAULT_ZOOM);
  const pin = { n: pins.length + 1, board: board.id, theme, ...point, text: '' };
  store.update({ pins: [...pins, pin], refused: null });
}

/**
 * @param {SectionPart} section
 * @param {BoardState} state
 * @param {CanvasView} view
 */
function updateSection({ board, heading, frames }, state, { zoom, hitEnabled, thisRoundTone }) {
  const isUpdated = state.updated.includes(board.id);
  setPart(
    heading,
    'canvas-updated',
    isUpdated ? buildElement('span', 'canvas-updated', 'Updated') : undefined,
  );
  for (const part of frames) {
    part.frame.style.width = `${board.w * zoom}px`;
    part.frame.style.height = `${board.h * zoom}px`;
    part.document.style.transform = `scale(${zoom})`;
    part.hit.disabled = !hitEnabled;
    const isHere = (/** @type {Pin} */ pin) => pin.board === board.id && pin.theme === part.theme;
    const markers = [
      ...state.earlier.filter(isHere).map((pin) => buildMarker(pin, 'muted', zoom)),
      ...state.pins.filter(isHere).map((pin) => buildMarker(pin, thisRoundTone, zoom)),
    ];
    for (const old of part.frame.querySelectorAll('.canvas-pin')) old.remove();
    part.frame.append(...markers);
  }
}

/**
 * @param {Pin} pin
 * @param {'hitl' | 'muted'} tone
 * @param {number} zoom
 * @returns {HTMLElement}
 */
function buildMarker(pin, tone, zoom) {
  const marker = buildElement('span', 'canvas-pin', String(pin.n));
  marker.setAttribute('aria-hidden', 'true');
  marker.dataset['tone'] = tone;
  marker.style.left = `${pin.x * zoom}px`;
  marker.style.top = `${pin.y * zoom}px`;
  return marker;
}

/**
 * @param {number} zoom
 * @returns {number} within 0.25–2, rounded to 0.01
 */
export function clampZoom(zoom) {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 100) / 100;
}

/**
 * @param {number} canvasWidth main's client width
 * @param {ReadonlyArray<{ w: number }>} boards
 * @returns {number} the zoom at which two frames of the widest board fit side by side
 */
export function fitZoom(canvasWidth, boards) {
  const widest = Math.max(...boards.map((board) => board.w));
  return clampZoom((canvasWidth - FIT_SLACK) / (widest * FRAMES_PER_BOARD));
}

/**
 * @param {number | null} zoom
 * @param {number} deltaY the wheel's vertical delta
 * @returns {number}
 */
export function wheelZoom(zoom, deltaY) {
  return clampZoom((zoom ?? DEFAULT_ZOOM) * Math.exp(-deltaY * WHEEL_RATE));
}

/**
 * @param {number | null} zoom
 * @param {string} key `KeyboardEvent.key`, pressed with Ctrl or Command
 * @returns {number | undefined} the next zoom, or undefined when `key` is no zoom key
 */
export function keyZoom(zoom, key) {
  const current = zoom ?? DEFAULT_ZOOM;
  if (key === '+' || key === '=') return clampZoom(current * KEY_STEP);
  if (key === '-') return clampZoom(current / KEY_STEP);
  return undefined;
}

/**
 * @typedef {object} HitBox the hit button's client rect and layout width
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} offsetWidth
 */

/**
 * Turns a click on a frame into board pixels.
 * @param {{ clientX: number, clientY: number }} click
 * @param {HitBox} box
 * @param {number} zoom
 * @returns {{ x: number, y: number }}
 */
export function toBoardPoint({ clientX, clientY }, box, zoom) {
  const scale = box.offsetWidth / box.width;
  return {
    x: Math.round(((clientX - box.left) * scale) / zoom),
    y: Math.round(((clientY - box.top) * scale) / zoom),
  };
}

/**
 * @param {boolean} commenting
 * @param {boolean} inputOn
 * @returns {boolean} whether a click on a frame places a pin
 */
export function isHitEnabled(commenting, inputOn) {
  return commenting && inputOn;
}
