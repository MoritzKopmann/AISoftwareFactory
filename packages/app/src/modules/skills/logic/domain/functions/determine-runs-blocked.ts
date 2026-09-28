import type { CredentialSnapshot } from '../types/credential-snapshot.js';
import type { RunsBlocked, SkillsStatus } from '../types/skills-status.js';

const nonSubscriptionVariables: ReadonlyArray<string> = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
];

function findCredentialBlock(credentials: CredentialSnapshot): RunsBlocked {
  const blockingVariable = nonSubscriptionVariables.find((variableName) =>
    credentials.setEnvironmentVariables.includes(variableName),
  );
  if (blockingVariable !== undefined) {
    return {
      blocked: true,
      reason: `Runs would bill ${blockingVariable}, not your Claude login. Unset it to run.`,
    };
  }
  const [apiKeyHelperFile] = credentials.apiKeyHelperFiles;
  if (apiKeyHelperFile !== undefined) {
    return {
      blocked: true,
      reason: `Runs would bill the apiKeyHelper in ${apiKeyHelperFile}, not your Claude login. Remove it to run.`,
    };
  }
  return { blocked: false };
}

export function determineRunsBlocked(
  status: SkillsStatus,
  credentials: CredentialSnapshot | undefined,
): RunsBlocked {
  if (credentials !== undefined) {
    const credentialBlock = findCredentialBlock(credentials);
    if (credentialBlock.blocked) {
      return credentialBlock;
    }
  }
  switch (status.state) {
    case 'passed':
      return { blocked: false };
    case 'failed':
      return { blocked: true, reason: status.reason };
    case 'pending':
      return { blocked: true, reason: 'Skills start-up checks have not finished' };
  }
}
