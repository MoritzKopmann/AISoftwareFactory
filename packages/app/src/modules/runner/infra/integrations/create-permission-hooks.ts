import { isDeepStrictEqual } from 'node:util';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import type { PermissionRequest } from '../../logic/domain/types/permission-request.js';
import type { PermissionVerdict } from '../../logic/domain/types/permission-verdict.js';
import type { ToolCall } from '../../logic/domain/types/tool-call.js';

type DecidePermission = (request: PermissionRequest) => Promise<PermissionVerdict>;

/**
 * Hooks that send auto-mode classifier denials through `decidePermission`.
 * On Allow, the identical retried call is pre-allowed once.
 */
export function createPermissionHooks(
  decidePermission: DecidePermission,
  answerTimeoutMilliseconds: number,
  initialAllowedCall?: ToolCall,
): NonNullable<Options['hooks']> {
  let allowedCall = initialAllowedCall;

  return {
    PreToolUse: [
      {
        hooks: [
          async (input) => {
            if (
              input.hook_event_name !== 'PreToolUse' ||
              allowedCall === undefined ||
              allowedCall.toolName !== input.tool_name ||
              !isDeepStrictEqual(allowedCall.toolInput, input.tool_input)
            ) {
              return {};
            }
            allowedCall = undefined;
            return {
              hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
            };
          },
        ],
      },
    ],
    PermissionDenied: [
      {
        timeout: Math.ceil(answerTimeoutMilliseconds / 1000),
        hooks: [
          async (input) => {
            if (
              input.hook_event_name !== 'PermissionDenied' ||
              typeof input.tool_input !== 'object' ||
              input.tool_input === null
            ) {
              return {};
            }
            const call: ToolCall = {
              toolName: input.tool_name,
              toolInput: input.tool_input as ToolCall['toolInput'],
            };
            const verdict = await decidePermission({ ...call, reason: input.reason });
            if (verdict.kind !== 'allow') {
              return {};
            }
            allowedCall = call;
            return { hookSpecificOutput: { hookEventName: 'PermissionDenied', retry: true } };
          },
        ],
      },
    ],
  };
}
