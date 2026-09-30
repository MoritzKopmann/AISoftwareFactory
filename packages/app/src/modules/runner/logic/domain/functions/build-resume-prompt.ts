import type { PermissionDecision } from '../types/permission-decision.js';
import type { ToolCall } from '../types/tool-call.js';

// A neutral "carry on" prompt makes the session re-issue nothing, so the prompt names the call and the decision.
export function buildResumePrompt(toolCall: ToolCall, decision: PermissionDecision): string {
  const callDescription = `${toolCall.toolName} with input ${JSON.stringify(toolCall.toolInput)}`;
  return decision === 'allow'
    ? `A human allowed your call to ${callDescription}. Issue that exact call again now and carry on.`
    : `A human refused your call to ${callDescription}. Do not retry it; carry on without it.`;
}
