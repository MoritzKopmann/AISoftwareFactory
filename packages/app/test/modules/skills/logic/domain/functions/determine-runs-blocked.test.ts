import { describe, expect, it } from 'vitest';
import { determineRunsBlocked } from '../../../../../../src/modules/skills/logic/domain/functions/determine-runs-blocked.js';
import type { CredentialSnapshot } from '../../../../../../src/modules/skills/logic/domain/types/credential-snapshot.js';

const passed = { state: 'passed' } as const;

function snapshot(overrides: Partial<CredentialSnapshot> = {}): CredentialSnapshot {
  return { setEnvironmentVariables: [], apiKeyHelperFiles: [], ...overrides };
}

describe('determineRunsBlocked', () => {
  it('should not block when no credential variables are set', () => {
    expect(determineRunsBlocked(passed, snapshot())).toEqual({ blocked: false });
  });

  it('should not block when only CLAUDE_CODE_OAUTH_TOKEN is set', () => {
    const credentials = snapshot({
      setEnvironmentVariables: ['CLAUDE_CODE_OAUTH_TOKEN', 'PATH'],
    });

    expect(determineRunsBlocked(passed, credentials)).toEqual({ blocked: false });
  });

  it('should block with the fix when ANTHROPIC_API_KEY is set', () => {
    const credentials = snapshot({ setEnvironmentVariables: ['ANTHROPIC_API_KEY'] });

    expect(determineRunsBlocked(passed, credentials)).toEqual({
      blocked: true,
      reason: 'Runs would bill ANTHROPIC_API_KEY, not your Claude login. Unset it to run.',
    });
  });

  it.each([
    'ANTHROPIC_AUTH_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
  ])('should block naming the variable when %s is set', (variableName) => {
    const credentials = snapshot({ setEnvironmentVariables: [variableName] });

    expect(determineRunsBlocked(passed, credentials)).toEqual({
      blocked: true,
      reason: `Runs would bill ${variableName}, not your Claude login. Unset it to run.`,
    });
  });

  it('should block naming the settings file when a project apiKeyHelper is defined', () => {
    const credentials = snapshot({ apiKeyHelperFiles: ['.claude/settings.local.json'] });

    expect(determineRunsBlocked(passed, credentials)).toEqual({
      blocked: true,
      reason:
        'Runs would bill the apiKeyHelper in .claude/settings.local.json, not your Claude login. Remove it to run.',
    });
  });

  it('should block on credentials even when the smoke test failed', () => {
    const credentials = snapshot({ setEnvironmentVariables: ['ANTHROPIC_API_KEY'] });

    expect(determineRunsBlocked({ state: 'failed', reason: 'claude broke' }, credentials)).toEqual({
      blocked: true,
      reason: 'Runs would bill ANTHROPIC_API_KEY, not your Claude login. Unset it to run.',
    });
  });

  it('should keep the smoke test verdict when credentials are clean', () => {
    expect(determineRunsBlocked({ state: 'failed', reason: 'claude broke' }, snapshot())).toEqual({
      blocked: true,
      reason: 'claude broke',
    });
  });

  it('should block while start-up is pending when credentials are unread', () => {
    expect(determineRunsBlocked({ state: 'pending' }, undefined)).toEqual({
      blocked: true,
      reason: 'Skills start-up checks have not finished',
    });
  });
});
