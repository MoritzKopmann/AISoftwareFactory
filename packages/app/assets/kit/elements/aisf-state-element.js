import {
  addOnce,
  estimateWidth,
  figureSvg,
  markedClass,
  readLabel,
  readMark,
  setFigure,
  svgElement,
  svgLabel,
  TEXT_BASELINE_OFFSET,
} from '../support/svg.js';

const MARGIN = 16;
const BOX_HEIGHT = 40;
const ARC_BASE = 36;
const ARC_STEP = 22;
const LABEL_ROOM = 22;
const ANCHOR_OFFSET = 14;
const MIN_BOX_WIDTH = 110;
const MIN_GAP = 120;
const LABEL_GAP_PADDING = 20;
const LOOP_PEAK_SHARE = 0.75;
const LABEL_LIFT = 6;
const LABEL_DROP = 16;

export class AisfStateElement extends HTMLElement {
  /** @type {string[]} */
  static observedAttributes = [];

  connectedCallback() {
    this.render();
  }

  /** Internal. Draws the states in a row, one arc per step: forward above, backward below. */
  render() {
    const steps = [...this.querySelectorAll(':scope > aisf-step')];
    /** @type {string[]} */
    const states = [];
    for (const step of steps) {
      addOnce(states, step.getAttribute('from') ?? '');
      addOnce(states, step.getAttribute('to') ?? '');
    }
    const boxWidth = Math.max(MIN_BOX_WIDTH, ...states.map((state) => estimateWidth(state)));
    const labelWidth = Math.max(0, ...steps.map((step) => estimateWidth(readLabel(step))));
    const gap = Math.max(MIN_GAP, labelWidth + LABEL_GAP_PADDING);
    const centreX = (/** @type {string} */ name) =>
      MARGIN + boxWidth / 2 + states.indexOf(name) * (boxWidth + gap);

    /** @type {Map<string, number>} */
    const used = new Map();
    const arcs = steps.map((step) => {
      const from = step.getAttribute('from') ?? '';
      const to = step.getAttribute('to') ?? '';
      const up = states.indexOf(from) <= states.indexOf(to);
      const side = up ? 'up' : 'down';
      const slot = used.get(side) ?? 0;
      used.set(side, slot + 1);
      const span = Math.abs(states.indexOf(from) - states.indexOf(to));
      const height = ARC_BASE + (span === 0 ? 0 : (span - 1) * ARC_STEP) + slot * ARC_STEP;
      return { step, from, to, up, height };
    });
    const above =
      Math.max(0, ...arcs.filter((arc) => arc.up).map((arc) => arc.height)) + LABEL_ROOM;
    const below =
      Math.max(0, ...arcs.filter((arc) => !arc.up).map((arc) => arc.height)) + LABEL_ROOM;
    const top = MARGIN + (arcs.some((arc) => arc.up) ? above : 0);
    const width = MARGIN * 2 + states.length * boxWidth + Math.max(0, states.length - 1) * gap;
    const height = top + BOX_HEIGHT + (arcs.some((arc) => !arc.up) ? below : 0) + MARGIN;

    const parts = states.map((state) => {
      const boxCentreX = centreX(state);
      return svgElement('g', { class: 'aisf-state-box', 'data-state': state }, [
        svgElement('rect', {
          class: 'aisf-shape',
          x: boxCentreX - boxWidth / 2,
          y: top,
          width: boxWidth,
          height: BOX_HEIGHT,
          rx: BOX_HEIGHT / 2,
        }),
        svgLabel(boxCentreX, top + BOX_HEIGHT / 2 + TEXT_BASELINE_OFFSET, state),
      ]);
    });
    for (const arc of arcs) parts.push(drawArc(arc, centreX(arc.from), centreX(arc.to), top));
    const title = `States ${states.join(', ')}: ${steps.length} transition${steps.length === 1 ? '' : 's'}`;
    setFigure(this, figureSvg(width, height, title, parts));
  }
}

/**
 * @param {{ step: Element, from: string, to: string, up: boolean, height: number }} arc
 * @param {number} fromX
 * @param {number} toX
 * @param {number} top
 */
function drawArc(arc, fromX, toX, top) {
  const edgeY = arc.up ? top : top + BOX_HEIGHT;
  const direction = arc.up ? -1 : 1;
  const isLoop = arc.from === arc.to;
  const startX = isLoop ? fromX - ANCHOR_OFFSET : fromX + (arc.up ? ANCHOR_OFFSET : -ANCHOR_OFFSET);
  const endX = isLoop ? fromX + ANCHOR_OFFSET : toX + (arc.up ? -ANCHOR_OFFSET : ANCHOR_OFFSET);
  const peak = arc.height * direction;
  const pathData = isLoop
    ? `M${startX} ${edgeY} C${startX} ${edgeY + peak} ${endX} ${edgeY + peak} ${endX} ${edgeY}`
    : `M${startX} ${edgeY} Q${(startX + endX) / 2} ${edgeY + 2 * peak} ${endX} ${edgeY}`;
  const apex = isLoop ? edgeY + peak * LOOP_PEAK_SHARE : edgeY + peak;
  const labelY = arc.up ? apex - LABEL_LIFT : apex + LABEL_DROP;
  return svgElement('g', { class: 'aisf-link', 'data-from': arc.from, 'data-to': arc.to }, [
    svgElement('path', { class: markedClass('aisf-edge', readMark(arc.step)), d: pathData }),
    svgLabel((startX + endX) / 2, labelY, readLabel(arc.step)),
  ]);
}
