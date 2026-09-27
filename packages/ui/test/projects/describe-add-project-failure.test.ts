import { describe, expect, it } from 'vitest';
import { describeAddProjectFailure } from '../../src/projects/describe-add-project-failure.js';

describe('describeAddProjectFailure', () => {
  it('should say the app could not be reached when there is no status', () => {
    expect(describeAddProjectFailure(undefined, undefined)).toBe('The app could not be reached');
  });

  it("should return the server's message when the body has one", () => {
    expect(describeAddProjectFailure(409, { message: 'owner/name is already added' })).toBe(
      'owner/name is already added',
    );
  });

  it('should report the status code when the body has no message', () => {
    expect(describeAddProjectFailure(500, undefined)).toBe('Adding the project failed (HTTP 500)');
  });
});
