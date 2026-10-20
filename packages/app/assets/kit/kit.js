// The kit's one entry, served at /aisf/kit.js. Registers every element.
import { AisfCardElement } from './elements/aisf-card-element.js';
import { AisfConfirmElement } from './elements/aisf-confirm-element.js';
import { AisfContextElement } from './elements/aisf-context-element.js';
import { AisfFigureElement } from './elements/aisf-figure-element.js';
import { AisfMetaElement } from './elements/aisf-meta-element.js';
import { AisfMoreElement } from './elements/aisf-more-element.js';
import { AisfPrecedentElement } from './elements/aisf-precedent-element.js';
import { AisfQuestionElement } from './elements/aisf-question-element.js';
import { AisfRoundElement } from './elements/aisf-round-element.js';
import { AisfTaskElement } from './elements/aisf-task-element.js';
import { AisfTreeNodeElement } from './elements/aisf-tree-node-element.js';

/**
 * Tag name to element class. A card comes before its question: the question renders its cards
 * on upgrade.
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
};

for (const [tag, elementClass] of Object.entries(registry)) {
  if (customElements.get(tag) === undefined) customElements.define(tag, elementClass);
}
