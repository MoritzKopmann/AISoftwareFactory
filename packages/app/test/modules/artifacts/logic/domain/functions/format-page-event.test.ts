import { describe, expect, it } from 'vitest';
import { formatPageEvent } from '../../../../../../src/modules/artifacts/logic/domain/functions/format-page-event.js';

describe('formatPageEvent', () => {
  it('should tag compact JSON with artifact, kind and round when the event is a submit', () => {
    expect(
      formatPageEvent('plan-round', { kind: 'submit', round: 2, payload: { a: 1, b: [1, 2] } }),
    ).toBe('<aisf-event artifact=plan-round kind=submit round=2>{"a":1,"b":[1,2]}</aisf-event>');
  });

  it('should keep the kind as sent when the event is a confirm', () => {
    expect(
      formatPageEvent('plan-round', { kind: 'confirm', round: 3, payload: { confirmed: true } }),
    ).toBe('<aisf-event artifact=plan-round kind=confirm round=3>{"confirmed":true}</aisf-event>');
  });
});
