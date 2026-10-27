// The kit's one entry, served at /aisf/kit.js. Registers every element.
import { AisfActorElement } from './elements/aisf-actor-element.js';
import { AisfCardElement } from './elements/aisf-card-element.js';
import { AisfConfirmElement } from './elements/aisf-confirm-element.js';
import { AisfContextElement } from './elements/aisf-context-element.js';
import { AisfFigureElement } from './elements/aisf-figure-element.js';
import { AisfMetaElement } from './elements/aisf-meta-element.js';
import { AisfMoreElement } from './elements/aisf-more-element.js';
import { AisfModmapElement } from './elements/aisf-modmap-element.js';
import { AisfPlaybackElement } from './elements/aisf-playback-element.js';
import { AisfPrecedentElement } from './elements/aisf-precedent-element.js';
import { AisfQuestionElement } from './elements/aisf-question-element.js';
import { AisfRoundElement } from './elements/aisf-round-element.js';
import { AisfSequenceElement } from './elements/aisf-sequence-element.js';
import { AisfStateElement } from './elements/aisf-state-element.js';
import { AisfStepElement } from './elements/aisf-step-element.js';
import { AisfTaskElement } from './elements/aisf-task-element.js';
import { AisfTreeNodeElement } from './elements/aisf-tree-node-element.js';
import { AisfUnitElement } from './elements/aisf-unit-element.js';

/**
 * Tag name to element class. A card comes before its question: the question renders its cards
 * on upgrade. Actors, steps and units come before the pieces that draw them.
 */
export const registry = {
  'aisf-round': AisfRoundElement,
  'aisf-card': AisfCardElement,
  'aisf-question': AisfQuestionElement,
  'aisf-context': AisfContextElement,
  'aisf-confirm': AisfConfirmElement,
  'aisf-meta': AisfMetaElement,
  'aisf-more': AisfMoreElement,
  'aisf-figure': AisfFigureElement,
  'aisf-tree-node': AisfTreeNodeElement,
  'aisf-task': AisfTaskElement,
  'aisf-precedent': AisfPrecedentElement,
  'aisf-actor': AisfActorElement,
  'aisf-step': AisfStepElement,
  'aisf-unit': AisfUnitElement,
  'aisf-sequence': AisfSequenceElement,
  'aisf-state': AisfStateElement,
  'aisf-modmap': AisfModmapElement,
  'aisf-playback': AisfPlaybackElement,
};

const ARROWHEAD_ID = 'aisf-arrowhead';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

for (const [tag, elementClass] of Object.entries(registry)) {
  if (customElements.get(tag) === undefined) customElements.define(tag, elementClass);
}

appendArrowheadMarker();

// One hidden arrowhead for every `aisf-edge` line, drawn in the edge's own colour.
function appendArrowheadMarker() {
  if (document.getElementById(ARROWHEAD_ID) !== null) return;
  const holder = createSvgElement('svg', { 'aria-hidden': 'true', width: '0', height: '0' });
  holder.style.position = 'absolute';
  const head = createSvgElement('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'context-stroke' });
  const marker = createSvgElement('marker', {
    id: ARROWHEAD_ID,
    viewBox: '0 0 10 10',
    refX: '9',
    refY: '5',
    markerWidth: '8',
    markerHeight: '8',
    orient: 'auto-start-reverse',
  });
  marker.append(head);
  const defs = createSvgElement('defs', {});
  defs.append(marker);
  holder.append(defs);
  document.body.append(holder);
}

/**
 * @param {string} tagName
 * @param {Record<string, string>} attributes
 */
function createSvgElement(tagName, attributes) {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}
