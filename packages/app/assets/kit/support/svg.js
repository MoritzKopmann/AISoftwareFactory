// SVG helpers shared by the kit's computed pieces (sequence, state, module map).
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MARKS = ['new', 'changed', 'untouched', 'removed'];

/** Font size in user units. The svg is never scaled up, so text stays at least this big. */
export const TEXT_SIZE = 13;

/** Drop from a box's vertical centre to a label's baseline, so the text looks centred. */
export const TEXT_BASELINE_OFFSET = 5;

const CHARACTER_WIDTH = 8;
const TEXT_PADDING = 24;

/**
 * @param {string} tagName
 * @param {Record<string, string | number>} [attributes]
 * @param {Array<Element>} [children]
 * @returns {SVGElement}
 */
export function svgElement(tagName, attributes = {}, children = []) {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  element.append(...children);
  return /** @type {SVGElement} */ (element);
}

/**
 * A label in the kit's text style.
 * @param {number} positionX
 * @param {number} positionY
 * @param {string} text
 * @param {string} [extraClass]
 */
export function svgLabel(positionX, positionY, text, extraClass = '') {
  const label = svgElement('text', {
    class: `aisf-label ${extraClass}`.trim(),
    x: positionX,
    y: positionY,
    'text-anchor': 'middle',
  });
  label.style.fontSize = `${TEXT_SIZE}px`;
  label.textContent = text;
  return label;
}

/**
 * The outer svg of a computed piece: viewBox, role, title.
 * @param {number} width
 * @param {number} height
 * @param {string} title
 * @param {Element[]} children
 */
export function figureSvg(width, height, title, children) {
  const svg = svgElement(
    'svg',
    {
      class: 'aisf-computed',
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'img',
    },
    [svgElement('title', {}), ...children],
  );
  const titleElement = svg.querySelector('title');
  if (titleElement !== null) titleElement.textContent = title;
  return svg;
}

/**
 * `new`, `changed`, `untouched` or `removed` from the element's `mark`; anything else is plain.
 * @param {Element} element
 * @returns {string | undefined}
 */
export function readMark(element) {
  const mark = element.getAttribute('mark');
  return mark !== null && MARKS.includes(mark) ? mark : undefined;
}

/**
 * Adds the mark's variant to a base class name.
 * @param {string} base
 * @param {string | undefined} mark
 */
export function markedClass(base, mark) {
  return mark === undefined ? base : `${base} ${base}-${mark}`;
}

/**
 * Adds the warning outline variant to a shape class.
 * @param {string} shapeClass
 */
export function flaggedClass(shapeClass) {
  return `${shapeClass} aisf-shape-flagged`;
}

/**
 * A rough text width in user units; layout needs no more than this.
 * @param {string} text
 */
export function estimateWidth(text) {
  return text.length * CHARACTER_WIDTH + TEXT_PADDING;
}

/** @param {Element} element */
export function readLabel(element) {
  return (element.textContent ?? '').trim();
}

/**
 * Appends or replaces the one generated svg of `host`.
 * @param {HTMLElement} host
 * @param {SVGElement} svg
 */
export function setFigure(host, svg) {
  const current = host.querySelector(':scope > svg.aisf-computed');
  if (current === null) host.append(svg);
  else current.replaceWith(svg);
}

/**
 * Asks the enclosing computed piece to draw again after a child's attribute changed.
 * @param {Element} child
 * @param {string} hostTag
 */
export function redrawHost(child, hostTag) {
  const host = child.closest(hostTag);
  if (host !== null && 'render' in host && typeof host.render === 'function') host.render();
}

/**
 * Adds `value` to `list` once, keeping first-seen order.
 * @param {string[]} list
 * @param {string} value
 */
export function addOnce(list, value) {
  if (!list.includes(value)) list.push(value);
}
