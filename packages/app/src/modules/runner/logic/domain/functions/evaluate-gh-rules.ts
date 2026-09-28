import { allowVerdict } from '../constants/allow-verdict.js';
import type { PolicyVerdict } from '../types/policy-verdict.js';
import { denyToolCall } from './deny-tool-call.js';

const repositoryOptions: ReadonlySet<string> = new Set(['-R', '--repo', '--hostname']);
const apiOptionsWithValue: ReadonlySet<string> = new Set([
  '-X',
  '--method',
  '-H',
  '--header',
  '-f',
  '--raw-field',
  '-F',
  '--field',
  '--input',
  '-q',
  '--jq',
  '-t',
  '--template',
  '--hostname',
  '--cache',
  '-p',
  '--preview',
]);
const apiFieldOptions: ReadonlySet<string> = new Set([
  '-f',
  '--raw-field',
  '-F',
  '--field',
  '--input',
]);
const mergeMutations: ReadonlyArray<string> = ['mergePullRequest', 'enablePullRequestAutoMerge'];
const mergeEndpoints: ReadonlyArray<RegExp> = [/\/pulls\/[^/]+\/merge$/, /\/merges$/];
const adminEndpoints: ReadonlyArray<RegExp> = [
  /\/releases(\/|$)/,
  /\/actions\/(secrets|variables)(\/|$)/,
  /\/dependabot\/secrets(\/|$)/,
  /\/dispatches$/,
  /\/(hooks|keys|rulesets)(\/|$)/,
  /\/branches\/[^/]+\/protection(\/|$)/,
  /^\/?repos\/[^/]+\/[^/]+\/?$/,
];
const adminCommands: Readonly<Record<string, ReadonlyArray<string> | undefined>> = {
  release: ['create', 'edit', 'delete', 'delete-asset', 'upload'],
  workflow: ['run', 'enable', 'disable'],
};
const readOnlyRepoCommands: ReadonlySet<string> = new Set(['view', 'clone', 'list']);

export function evaluateGhRules(words: ReadonlyArray<string>): PolicyVerdict {
  if (words[0] !== 'gh') {
    return allowVerdict;
  }
  const commandWords = withoutRepositoryOptions(words.slice(1));
  const groupIndex = commandWords.findIndex((word) => !word.startsWith('-'));
  const group = commandWords[groupIndex];
  const subcommand = commandWords.slice(groupIndex + 1).find((word) => !word.startsWith('-')) ?? '';
  if (group === 'pr' && subcommand === 'merge') {
    return denyToolCall('gh-merge', 'merging a pull request is left to a human.');
  }
  if (group === 'api') {
    return evaluateApiCall(commandWords.slice(groupIndex + 1));
  }
  const isAdminCommand =
    group === 'secret' ||
    group === 'variable' ||
    (group === 'repo' && !readOnlyRepoCommands.has(subcommand)) ||
    (group !== undefined && adminCommands[group]?.includes(subcommand) === true);
  return isAdminCommand
    ? denyToolCall(
        'gh-admin',
        `gh ${group ?? ''} ${subcommand} changes the repository's admin state.`,
      )
    : allowVerdict;
}

function withoutRepositoryOptions(words: ReadonlyArray<string>): ReadonlyArray<string> {
  const kept: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    if (repositoryOptions.has(word)) {
      index += 1;
    } else {
      kept.push(word);
    }
  }
  return kept;
}

function evaluateApiCall(apiArguments: ReadonlyArray<string>): PolicyVerdict {
  if (apiArguments.some((word) => mergeMutations.some((mutation) => word.includes(mutation)))) {
    return denyToolCall('gh-merge', 'a GraphQL merge mutation is left to a human.');
  }
  const endpoint = findEndpoint(apiArguments);
  if (endpoint === undefined || !isMutating(apiArguments)) {
    return allowVerdict;
  }
  if (mergeEndpoints.some((pattern) => pattern.test(endpoint))) {
    return denyToolCall('gh-merge', `writing to ${endpoint} merges; that is left to a human.`);
  }
  if (adminEndpoints.some((pattern) => pattern.test(endpoint))) {
    return denyToolCall('gh-admin', `writing to ${endpoint} changes the repository's admin state.`);
  }
  return allowVerdict;
}

function findEndpoint(apiArguments: ReadonlyArray<string>): string | undefined {
  for (let index = 0; index < apiArguments.length; index += 1) {
    const word = apiArguments[index] ?? '';
    if (apiOptionsWithValue.has(word)) {
      index += 1;
    } else if (!word.startsWith('-')) {
      return word;
    }
  }
  return undefined;
}

function isMutating(apiArguments: ReadonlyArray<string>): boolean {
  const method = findMethod(apiArguments);
  if (method !== undefined) {
    return method.toUpperCase() !== 'GET';
  }
  return apiArguments.some((word) => apiFieldOptions.has(word));
}

function findMethod(apiArguments: ReadonlyArray<string>): string | undefined {
  const methodIndex = apiArguments.findIndex((word) => word === '-X' || word === '--method');
  if (methodIndex !== -1) {
    return apiArguments[methodIndex + 1];
  }
  const attached = apiArguments.find((word) => /^(--method=|-X.)/.test(word));
  return attached?.replace(/^(--method=|-X)/, '');
}
