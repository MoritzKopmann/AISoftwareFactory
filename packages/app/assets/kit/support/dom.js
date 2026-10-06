// Small DOM helpers shared by the kit's elements.

/**
 * Creates an element with a class and optional text.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function buildElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * Appends or replaces the one generated child of `host` marked by `className`.
 * Passing `undefined` removes it.
 * @param {HTMLElement} host
 * @param {string} className
 * @param {HTMLElement | undefined} next
 * @param {'start' | 'end'} [where]
 */
export function setPart(host, className, next, where = 'end') {
  const current = [...host.children].find((child) => child.classList.contains(className));
  if (current !== undefined && next !== undefined) {
    current.replaceWith(next);
  } else if (current !== undefined) {
    current.remove();
  } else if (next !== undefined) {
    if (where === 'start') host.prepend(next);
    else host.append(next);
  }
}

/**
 * Tells the enclosing round that something a human changed needs saving.
 * @param {HTMLElement} source
 */
export function announceChange(source) {
  source.dispatchEvent(new CustomEvent('aisf-change', { bubbles: true }));
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
