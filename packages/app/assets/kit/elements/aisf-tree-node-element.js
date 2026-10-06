import { buildElement, setPart } from '../support/dom.js';

export class AisfTreeNodeElement extends HTMLElement {
  static observedAttributes = ['round', 'question', 'resolution', 'rejected', 'assumes', 'fact'];

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /** Internal. Builds one row of the decision tree from the attributes; nested nodes stay children. */
  render() {
    const row = buildElement('div', 'aisf-tree-row');
    /** @type {Array<[string, string, string | null]>} */
    const parts = [
      [
        'round',
        'aisf-tree-round',
        this.getAttribute('round') === null ? null : `R${this.getAttribute('round')}`,
      ],
      ['question', 'aisf-tree-question', this.getAttribute('question')],
      ['resolution', 'aisf-tree-resolution', this.getAttribute('resolution')],
      [
        'assumes',
        'aisf-tree-assumes',
        this.getAttribute('assumes') === null ? null : `assumes: ${this.getAttribute('assumes')}`,
      ],
      [
        'fact',
        'aisf-tree-fact',
        this.getAttribute('fact') === null ? null : `fact: ${this.getAttribute('fact')}`,
      ],
    ];
    for (const [, className, text] of parts) {
      if (text !== null) row.append(buildElement('span', className, text));
    }
    setPart(this, 'aisf-tree-row', row, 'start');
  }
}
