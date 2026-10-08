import type { HookCallback, HookInput } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import type { PermissionRequest } from '../../../../../src/modules/runner/logic/domain/types/permission-request.js';
import type { PermissionVerdict } from '../../../../../src/modules/runner/logic/domain/types/permission-verdict.js';
import type { ToolCall } from '../../../../../src/modules/runner/logic/domain/types/tool-call.js';
import { createPermissionHooks } from '../../../../../src/modules/runner/infra/integrations/create-permission-hooks.js';

const allow: PermissionVerdict = { kind: 'allow' };
const humanDeny: PermissionVerdict = {
  kind: 'deny',
  message: 'A human refused this tool call. Do not retry it; carry on without it.',
};
const windowDeny: PermissionVerdict = {
  kind: 'deny',
  message:
    'The answer window has passed. End your turn: the app resumes this session when the human answers.',
};

const commentInput = { command: 'gh issue comment 1 --body hi', description: 'Post comment' };

function build(verdict: PermissionVerdict, initialAllowedCall?: ToolCall) {
  const requests: PermissionRequest[] = [];
  const hooks = createPermissionHooks(
    async (request) => {
      requests.push(request);
      return verdict;
    },
    660_500,
    initialAllowedCall,
  );
  const callbackFor = (event: 'PreToolUse' | 'PermissionDenied'): HookCallback => {
    const callback = hooks[event]?.[0]?.hooks[0];
    if (callback === undefined) {
      throw new Error(`no ${event} hook`);
    }
    return callback;
  };
  const run = (event: 'PreToolUse' | 'PermissionDenied', input: Record<string, unknown>) =>
    callbackFor(event)({ hook_event_name: event, ...input } as unknown as HookInput, undefined, {
      signal: new AbortController().signal,
    });
  return {
    hooks,
    requests,
    denied: (toolName: string, toolInput: unknown, reason = '[Reason]') =>
      run('PermissionDenied', { tool_name: toolName, tool_input: toolInput, reason }),
    preToolUse: (toolName: string, toolInput: unknown) =>
      run('PreToolUse', { tool_name: toolName, tool_input: toolInput }),
  };
}

const allowed = {
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
};

describe('createPermissionHooks', () => {
  it('should ask the human with the call and its reason when the classifier denies', async () => {
    const { denied, requests } = build(allow);

    await denied('Bash', commentInput, '[Data Exfiltration]');

    expect(requests).toEqual([
      { toolName: 'Bash', toolInput: commentInput, reason: '[Data Exfiltration]' },
    ]);
  });

  it('should ask for a retry when the human allows a classifier denial', async () => {
    const { denied } = build(allow);

    expect(await denied('Bash', { command: 'gh issue comment 1 --body hi' })).toEqual({
      hookSpecificOutput: { hookEventName: 'PermissionDenied', retry: true },
    });
  });

  it('should allow the identical retried call when the human allowed it', async () => {
    const { denied, preToolUse } = build(allow);
    await denied('Bash', commentInput);

    expect(await preToolUse('Bash', commentInput)).toEqual(allowed);
  });

  it('should not pre-allow the same call twice when it was allowed once', async () => {
    const { denied, preToolUse } = build(allow);
    await denied('Bash', commentInput);
    await preToolUse('Bash', commentInput);

    expect(await preToolUse('Bash', commentInput)).toEqual({});
  });

  it('should keep the allowance when only the description differs', async () => {
    const { denied, preToolUse } = build(allow);
    await denied('Bash', commentInput);

    expect(
      await preToolUse('Bash', { ...commentInput, description: 'Post comment again' }),
    ).toEqual({});
    expect(await preToolUse('Bash', commentInput)).toEqual(allowed);
  });

  it('should treat a star in the allowed input as plain text', async () => {
    const { denied, preToolUse } = build(allow);
    await denied('Bash', { command: 'rm *' });

    expect(await preToolUse('Bash', { command: 'rm a.txt' })).toEqual({});
  });

  it('should not pre-allow another tool when the input is the same', async () => {
    const { denied, preToolUse } = build(allow);
    await denied('Bash', { command: 'ls' });

    expect(await preToolUse('Write', { command: 'ls' })).toEqual({});
  });

  it('should leave the denial standing when the human denies', async () => {
    const { denied, preToolUse } = build(humanDeny);
    const input = { command: 'gh issue comment 1 --body hi' };

    expect(await denied('Bash', input)).toEqual({});
    expect(await preToolUse('Bash', input)).toEqual({});
  });

  it('should leave the denial standing without continue when the wait is unanswered', async () => {
    const { denied } = build(windowDeny);

    const output = await denied('Bash', { command: 'ls' });

    expect(output).toEqual({});
    expect(output).not.toHaveProperty('continue');
  });

  it('should replace the armed allowance when a newer allow arrives', async () => {
    const { denied, preToolUse } = build(allow);
    await denied('Bash', { command: 'a' });
    await denied('Bash', { command: 'b' });

    expect(await preToolUse('Bash', { command: 'a' })).toEqual({});
    expect(await preToolUse('Bash', { command: 'b' })).toEqual(allowed);
  });

  it('should honour a resume allowance once when seeded', async () => {
    const call = { toolName: 'Bash', toolInput: { command: 'gh issue comment 1 --body hi' } };
    const { preToolUse } = build(allow, call);

    expect(await preToolUse('Bash', call.toolInput)).toEqual(allowed);
    expect(await preToolUse('Bash', call.toolInput)).toEqual({});
  });

  it('should pre-allow nothing when there is no resume allowance', async () => {
    const { preToolUse } = build(allow);

    expect(await preToolUse('Bash', { command: 'ls' })).toEqual({});
  });

  it('should wait as long as the answer timeout when built', () => {
    const { hooks } = build(allow);

    expect(hooks.PermissionDenied).toHaveLength(1);
    expect(hooks.PermissionDenied?.[0]?.timeout).toBe(661);
    expect(hooks.PermissionDenied?.[0]).not.toHaveProperty('matcher');
    expect(hooks.PreToolUse).toHaveLength(1);
    expect(hooks.PreToolUse?.[0]).not.toHaveProperty('matcher');
  });
});
