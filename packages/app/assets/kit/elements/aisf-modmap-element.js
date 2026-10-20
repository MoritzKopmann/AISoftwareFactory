import {
  addOnce,
  estimateWidth,
  figureSvg,
  flaggedClass,
  markedClass,
  readLabel,
  readMark,
  setFigure,
  svgElement,
  svgLabel,
  TEXT_BASELINE_OFFSET,
} from '../support/svg.js';

const MARGIN = 16;
const HEAD_HEIGHT = 36;
const UNIT_HEIGHT = 40;
const UNIT_GAP = 8;
const CELL_PAD = 12;
const MIN_HEAD_WIDTH = 80;
const MIN_COLUMN_WIDTH = 150;
const CORNER_RADIUS = 6;

export class AisfModmapElement extends HTMLElement {
  static observedAttributes = ['layers'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /** Internal. Draws a module × layer grid: modules are columns, layers rows. */
  render() {
    const units = [...this.querySelectorAll(':scope > aisf-unit')].map((unit) => ({
      unit,
      module: unit.getAttribute('module') ?? '',
      layer: unit.getAttribute('layer') ?? '',
    }));
    const listed = (this.getAttribute('layers') ?? '').split(/\s+/).filter((layer) => layer !== '');
    const layers = [...listed];
    /** @type {string[]} */
    const modules = [];
    for (const { module, layer } of units) {
      addOnce(modules, module);
      addOnce(layers, layer);
    }

    const headWidth = Math.max(MIN_HEAD_WIDTH, ...layers.map((layer) => estimateWidth(layer)));
    const columnWidth = Math.max(
      MIN_COLUMN_WIDTH,
      ...modules.map((module) => estimateWidth(module)),
      ...units.map(({ unit }) => estimateWidth(readLabel(unit)) + 2 * CELL_PAD),
    );
    const cellUnits = (/** @type {string} */ module, /** @type {string} */ layer) =>
      units.filter((entry) => entry.module === module && entry.layer === layer);
    const rowHeights = layers.map((layer) => {
      const stacked = Math.max(1, ...modules.map((module) => cellUnits(module, layer).length));
      return stacked * UNIT_HEIGHT + (stacked - 1) * UNIT_GAP + 2 * CELL_PAD;
    });
    const gridTop = MARGIN + HEAD_HEIGHT;
    const gridLeft = MARGIN + headWidth;
    const rowTop = (/** @type {number} */ row) =>
      gridTop + rowHeights.slice(0, row).reduce((sum, rowHeight) => sum + rowHeight, 0);

    const parts = [];
    for (const [column, module] of modules.entries()) {
      const label = svgLabel(
        gridLeft + column * columnWidth + columnWidth / 2,
        MARGIN + HEAD_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
        module,
        'aisf-module-head',
      );
      parts.push(label);
    }
    for (const [row, layer] of layers.entries()) {
      const flagged = !listed.includes(layer);
      const label = svgLabel(
        MARGIN + headWidth / 2,
        rowTop(row) + (rowHeights[row] ?? 0) / 2 + TEXT_BASELINE_OFFSET,
        layer,
        flagged ? 'aisf-layer-head aisf-flagged' : 'aisf-layer-head',
      );
      parts.push(
        svgElement('line', {
          class: 'aisf-gridline',
          x1: MARGIN,
          y1: rowTop(row),
          x2: gridLeft + modules.length * columnWidth,
          y2: rowTop(row),
        }),
        label,
      );
    }
    for (const [row, layer] of layers.entries()) {
      for (const [column, module] of modules.entries()) {
        for (const [slot, { unit }] of cellUnits(module, layer).entries()) {
          const unitLeft = gridLeft + column * columnWidth + CELL_PAD;
          const unitTop = rowTop(row) + CELL_PAD + slot * (UNIT_HEIGHT + UNIT_GAP);
          const shapeClass = markedClass('aisf-shape', readMark(unit));
          const drawn = listed.includes(layer) ? shapeClass : flaggedClass(shapeClass);
          parts.push(
            drawUnit(unit, { module, layer, shapeClass: drawn }, unitLeft, unitTop, columnWidth),
          );
        }
      }
    }
    const width = gridLeft + modules.length * columnWidth + MARGIN;
    const height = rowTop(layers.length) + MARGIN;
    const title = `Module map: ${modules.length} module${modules.length === 1 ? '' : 's'} across ${layers.join(', ')}`;
    setFigure(this, figureSvg(width, height, title, parts));
  }
}

/**
 * @param {Element} unit
 * @param {{ module: string, layer: string, shapeClass: string }} cell
 * @param {number} left
 * @param {number} top
 * @param {number} columnWidth
 */
function drawUnit(unit, cell, left, top, columnWidth) {
  const width = columnWidth - 2 * CELL_PAD;
  return svgElement(
    'g',
    { class: 'aisf-unit-box', 'data-module': cell.module, 'data-layer': cell.layer },
    [
      svgElement('rect', {
        class: cell.shapeClass,
        x: left,
        y: top,
        width,
        height: UNIT_HEIGHT,
        rx: CORNER_RADIUS,
      }),
      svgLabel(left + width / 2, top + UNIT_HEIGHT / 2 + TEXT_BASELINE_OFFSET, readLabel(unit)),
    ],
  );
}
