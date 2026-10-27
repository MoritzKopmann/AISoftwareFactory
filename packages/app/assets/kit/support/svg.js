// SVG helpers for the playback map.
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Font size in user units. The svg is never scaled up, so text stays at least this big. */
export const TEXT_SIZE = 13;

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
 * The outer svg of the map: viewBox, role, title.
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
