// The kit's one entry, served at /aisf/kit.js. Registers every element.
import { AisfCardElement } from './elements/aisf-card-element.js';
import { AisfConfirmElement } from './elements/aisf-confirm-element.js';
import { AisfContextElement } from './elements/aisf-context-element.js';
import { AisfFigureElement } from './elements/aisf-figure-element.js';
import { AisfMetaElement } from './elements/aisf-meta-element.js';
import { AisfQuestionElement } from './elements/aisf-question-element.js';
import { AisfRoundElement } from './elements/aisf-round-element.js';
import { AisfTaskElement } from './elements/aisf-task-element.js';
import { AisfTreeNodeElement } from './elements/aisf-tree-node-element.js';

/** Tag name to element class. */
export const registry = {
  'aisf-round': AisfRoundElement,
  'aisf-question': AisfQuestionElement,
  'aisf-card': AisfCardElement,
  'aisf-context': AisfContextElement,
  'aisf-confirm': AisfConfirmElement,
  'aisf-meta': AisfMetaElement,
  'aisf-figure': AisfFigureElement,
  'aisf-tree-node': AisfTreeNodeElement,
  'aisf-task': AisfTaskElement,
};

for (const [tag, elementClass] of Object.entries(registry)) {
  if (customElements.get(tag) === undefined) customElements.define(tag, elementClass);
}
