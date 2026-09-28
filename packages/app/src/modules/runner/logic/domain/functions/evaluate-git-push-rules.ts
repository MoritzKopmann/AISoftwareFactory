import { allowVerdict } from '../constants/allow-verdict.js';
import type { PolicyVerdict } from '../types/policy-verdict.js';
import type { RunPolicyContext } from '../types/run-policy-context.js';
import { denyToolCall } from './deny-tool-call.js';

const globalOptionsWithValue: ReadonlySet<string> = new Set([
  '-C',
  '-c',
  '--namespace',
  '--exec-path',
  '--git-dir',
  '--work-tree',
  '--config-env',
  '--super-prefix',
]);
const pushOptionsWithValue: ReadonlySet<string> = new Set([
  '-o',
  '--push-option',
  '--repo',
  '--receive-pack',
  '--exec',
]);

export function evaluateGitPushRules(
  words: ReadonlyArray<string>,
  context: RunPolicyContext,
): PolicyVerdict {
  const pushArguments = argumentsAfterPush(words);
  if (pushArguments === undefined) {
    return allowVerdict;
  }
  const flags = pushArguments.filter((word) => word.startsWith('-'));
  const positionals = withoutOptionValues(pushArguments);
  const isForced = flags.some(
    (flag) => flag === '--force' || flag.startsWith('--force-') || /^-[a-z]*f[a-z]*$/.test(flag),
  );

  if (flags.includes('--mirror') || flags.includes('--all')) {
    return denyToolCall('push-mirror-or-all', 'pushing every ref is not allowed.');
  }
  if (
    flags.some((flag) => flag === '--delete' || flag === '--prune' || /^-[a-z]*d[a-z]*$/.test(flag))
  ) {
    return denyToolCall('push-delete', 'deleting remote branches is not allowed.');
  }
  for (const refspec of positionals.slice(1)) {
    const verdict = evaluateRefspec(refspec, isForced, context);
    if (verdict.kind === 'deny') {
      return verdict;
    }
  }
  return allowVerdict;
}

function argumentsAfterPush(words: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (words[0] !== 'git') {
    return undefined;
  }
  let index = 1;
  while (index < words.length && (words[index] ?? '').startsWith('-')) {
    index += globalOptionsWithValue.has(words[index] ?? '') ? 2 : 1;
  }
  return words[index] === 'push' ? words.slice(index + 1) : undefined;
}

function withoutOptionValues(pushArguments: ReadonlyArray<string>): ReadonlyArray<string> {
  const positionals: string[] = [];
  for (let index = 0; index < pushArguments.length; index += 1) {
    const word = pushArguments[index] ?? '';
    if (pushOptionsWithValue.has(word)) {
      index += 1;
    } else if (!word.startsWith('-')) {
      positionals.push(word);
    }
  }
  return positionals;
}

function evaluateRefspec(
  refspec: string,
  isForced: boolean,
  context: RunPolicyContext,
): PolicyVerdict {
  const isForcedByRefspec = refspec.startsWith('+');
  const [source = '', destination] = refspec.replace(/^\+/, '').split(':');
  if (source === '' && destination !== undefined) {
    return denyToolCall('push-delete', `deleting ${destination} on the remote is not allowed.`);
  }
  const target = normalizeBranch(destination ?? (source === 'HEAD' ? context.branchName : source));
  if (target === context.branchName) {
    return allowVerdict;
  }
  if (target === context.defaultBranch) {
    return denyToolCall('push-default-branch', `pushing to ${target} is not allowed.`);
  }
  if (isForced || isForcedByRefspec) {
    return denyToolCall(
      'force-push-other-branch',
      `force-pushing ${target} is not allowed; only ${context.branchName} may be force-pushed.`,
    );
  }
  return denyToolCall(
    'push-other-branch',
    `pushing ${target} is not allowed; only ${context.branchName} may be pushed.`,
  );
}

function normalizeBranch(reference: string): string {
  return reference.replace(/^refs\/heads\//, '');
}
