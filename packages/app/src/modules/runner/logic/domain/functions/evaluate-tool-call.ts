import { allowVerdict } from '../constants/allow-verdict.js';
import type { PolicyVerdict } from '../types/policy-verdict.js';
import type { RunPolicyContext } from '../types/run-policy-context.js';
import type { ToolCall } from '../types/tool-call.js';
import { evaluateGhRules } from './evaluate-gh-rules.js';
import { evaluateGitPushRules } from './evaluate-git-push-rules.js';
import { evaluatePathRules } from './evaluate-path-rules.js';
import { splitShellCommand } from './split-shell-command.js';

const editPathFields: Readonly<Record<string, string | undefined>> = {
  Edit: 'file_path',
  Write: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path',
};

export function evaluateToolCall(toolCall: ToolCall, context: RunPolicyContext): PolicyVerdict {
  if (toolCall.toolName === 'Bash') {
    return evaluateBashCommand(toolCall.input['command'], context);
  }
  const pathField = editPathFields[toolCall.toolName];
  const filePath = pathField === undefined ? undefined : toolCall.input[pathField];
  return typeof filePath === 'string' ? evaluatePathRules(filePath, context) : allowVerdict;
}

function evaluateBashCommand(command: unknown, context: RunPolicyContext): PolicyVerdict {
  if (typeof command !== 'string') {
    return allowVerdict;
  }
  for (const words of splitShellCommand(command)) {
    for (const verdict of [evaluateGitPushRules(words, context), evaluateGhRules(words)]) {
      if (verdict.kind === 'deny') {
        return verdict;
      }
    }
  }
  return allowVerdict;
}
