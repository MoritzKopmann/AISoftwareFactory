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
const ACTOR_HEIGHT = 36;
const ROW_HEIGHT = 48;
const LOOP_WIDTH = 28;
const LOOP_HALF_HEIGHT = 8;
const LOOP_RETURN_INSET = 2;
const LOOP_LABEL_GAP = 4;
const LABEL_LIFT = 8;
const MIN_COLUMN_WIDTH = 140;
const LABEL_COLUMN_PADDING = 20;
const ACTOR_COLUMN_PADDING = 16;
const ACTOR_BOX_INSET = 24;
const CORNER_RADIUS = 6;

export class AisfSequenceElement extends HTMLElement {
  /** @type {string[]} */
  static observedAttributes = [];

  connectedCallback() {
    this.render();
  }

  /** Internal. Draws lifeline columns for the actors and one row per step. */
  render() {
    const listed = [...this.querySelectorAll(':scope > aisf-actor')].map(
      (actor) => actor.getAttribute('name') ?? '',
    );
    const steps = [...this.querySelectorAll(':scope > aisf-step')];
    const actors = [...listed];
    for (const step of steps) {
      addOnce(actors, step.getAttribute('from') ?? '');
      addOnce(actors, step.getAttribute('to') ?? '');
    }
    const labelWidth = Math.max(0, ...steps.map((step) => estimateWidth(readLabel(step))));
    const columnWidth = Math.max(
      MIN_COLUMN_WIDTH,
      labelWidth + LABEL_COLUMN_PADDING,
      ...actors.map((actor) => estimateWidth(actor) + ACTOR_COLUMN_PADDING),
    );
    const centreX = (/** @type {string} */ name) =>
      MARGIN + columnWidth / 2 + actors.indexOf(name) * columnWidth;
    const width = MARGIN * 2 + actors.length * columnWidth + LOOP_WIDTH;
    const bottom = MARGIN + ACTOR_HEIGHT + (steps.length + 1) * ROW_HEIGHT;

    const parts = [];
    for (const name of actors) {
      const column = drawActorColumn(
        name,
        centreX(name),
        !listed.includes(name),
        columnWidth,
        bottom,
      );
      parts.push(column);
    }
    for (const [index, step] of steps.entries()) {
      const rowY = MARGIN + ACTOR_HEIGHT + (index + 1) * ROW_HEIGHT;
      parts.push(
        drawLink(
          step,
          centreX(step.getAttribute('from') ?? ''),
          centreX(step.getAttribute('to') ?? ''),
          rowY,
        ),
      );
    }
    const title = `Sequence of ${actors.join(', ')}: ${steps.length} step${steps.length === 1 ? '' : 's'}`;
    setFigure(this, figureSvg(width, bottom + MARGIN, title, parts));
  }
}

/**
 * @param {string} name
 * @param {number} centreX
 * @param {boolean} isUnlisted
 * @param {number} columnWidth
 * @param {number} bottom
 */
function drawActorColumn(name, centreX, isUnlisted, columnWidth, bottom) {
  const boxWidth = columnWidth - ACTOR_BOX_INSET;
  const shapeClass = isUnlisted ? flaggedClass('aisf-shape') : 'aisf-shape';
  const box = svgElement('rect', {
    class: shapeClass,
    x: centreX - boxWidth / 2,
    y: MARGIN,
    width: boxWidth,
    height: ACTOR_HEIGHT,
    rx: CORNER_RADIUS,
  });
  const group = svgElement('g', { class: 'aisf-actor-box', 'data-actor': name }, [
    svgElement('line', {
      class: 'aisf-lifeline',
      x1: centreX,
      y1: MARGIN + ACTOR_HEIGHT,
      x2: centreX,
      y2: bottom,
    }),
    box,
    svgLabel(centreX, MARGIN + ACTOR_HEIGHT / 2 + TEXT_BASELINE_OFFSET, name),
  ]);
  if (isUnlisted) group.setAttribute('data-flagged', 'true');
  return group;
}

/**
 * @param {Element} step
 * @param {number} fromX
 * @param {number} toX
 * @param {number} rowY
 */
function drawLink(step, fromX, toX, rowY) {
  const edgeClass = markedClass('aisf-edge', readMark(step));
  const isLoop = fromX === toX;
  const edge = isLoop
    ? svgElement('path', {
        class: edgeClass,
        d: `M${fromX} ${rowY - LOOP_HALF_HEIGHT} H${fromX + LOOP_WIDTH} V${rowY + LOOP_HALF_HEIGHT} H${fromX + LOOP_RETURN_INSET}`,
      })
    : svgElement('line', { class: edgeClass, x1: fromX, y1: rowY, x2: toX, y2: rowY });
  const labelX = isLoop ? fromX + LOOP_WIDTH + LOOP_LABEL_GAP : (fromX + toX) / 2;
  const label = svgLabel(labelX, rowY - LABEL_LIFT, readLabel(step));
  if (isLoop) label.setAttribute('text-anchor', 'start');
  return svgElement(
    'g',
    {
      class: 'aisf-link',
      'data-from': step.getAttribute('from') ?? '',
      'data-to': step.getAttribute('to') ?? '',
    },
    [edge, label],
  );
}
