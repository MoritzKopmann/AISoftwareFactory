import type { OnboardingResponse } from '../api/onboarding-schemas.js';

export function toOnboardingResponse(ticketNumber: number): OnboardingResponse {
  return { ticketNumber };
}
