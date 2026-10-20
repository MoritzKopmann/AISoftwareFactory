import { describe, expect, it } from 'vitest';
import { buildTicketResponse } from '../board/testing/fixtures/ticket-response.js';
import { describeOnboardingAction } from './describe-onboarding-action.js';

const failing = { passed: false, missingSlots: ['project-testing'], missingKeys: [] };
const passing = { passed: true, missingSlots: [], missingKeys: [] };

describe('describeOnboardingAction', () => {
  it('should show when the contract failed and no open ticket is an onboard one', () => {
    const tickets = [buildTicketResponse({ types: ['bug'] })];

    expect(describeOnboardingAction(failing, tickets)).toEqual({ kind: 'shown' });
  });

  it('should hide when the contract failed and an open ticket is an onboard one', () => {
    const tickets = [buildTicketResponse({ status: 'ready', types: ['onboard'] })];

    expect(describeOnboardingAction(failing, tickets)).toEqual({ kind: 'hidden' });
  });

  it('should show when the only onboard ticket is closed', () => {
    const tickets = [buildTicketResponse({ status: 'closed', types: ['onboard'] })];

    expect(describeOnboardingAction(failing, tickets)).toEqual({ kind: 'shown' });
  });

  it('should hide when the contract passed', () => {
    expect(describeOnboardingAction(passing, [])).toEqual({ kind: 'hidden' });
  });
});
