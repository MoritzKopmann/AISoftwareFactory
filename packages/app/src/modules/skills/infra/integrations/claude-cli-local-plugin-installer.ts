import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import type { ProcessResult } from '../../../../shared/process/run-process.js';
import { runProcess } from '../../../../shared/process/run-process.js';
import { SkillsSetupError } from '../../logic/errors/skills-setup-error.js';
import type { LocalPluginInstaller } from '../../logic/ports/local-plugin-installer.js';
import { runClaude } from './run-claude.js';

const commandTimeoutMilliseconds = 30_000;
const pluginInstallTimeoutMilliseconds = 60_000;

// The exclude step runs before the install call, so a crash can't leave a dirty `git status`.
const excludedPaths = ['.claude/settings.local.json', '.aisf/'];

export class ClaudeCliLocalPluginInstaller implements LocalPluginInstaller {
  async install(checkoutPath: string): Promise<void> {
    await excludeFromGit(checkoutPath, excludedPaths);
    await runClaude(['plugin', 'install', 'aisf@aisf', '--scope', 'local'], {
      workingDirectory: checkoutPath,
      timeoutMilliseconds: pluginInstallTimeoutMilliseconds,
    });
  }
}

export async function excludeFromGit(
  checkoutPath: string,
  relativePaths: ReadonlyArray<string>,
): Promise<void> {
  const excludeFilePath = await resolveGitPath(checkoutPath, 'info/exclude');
  const unignoredPaths: string[] = [];
  for (const relativePath of relativePaths) {
    if (!(await isIgnored(checkoutPath, relativePath))) {
      unignoredPaths.push(relativePath);
    }
  }
  if (unignoredPaths.length === 0) {
    return;
  }

  try {
    await mkdir(dirname(excludeFilePath), { recursive: true });
    for (const relativePath of unignoredPaths) {
      await appendFile(excludeFilePath, `${relativePath}\n`);
    }
  } catch (error) {
    throw new SkillsSetupError(`Cannot write ${excludeFilePath}: ${String(error)}`);
  }
}

async function runGit(
  checkoutPath: string,
  argumentList: ReadonlyArray<string>,
): Promise<ProcessResult> {
  try {
    return await runProcess('git', argumentList, {
      workingDirectory: checkoutPath,
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
  } catch (error) {
    throw new SkillsSetupError(`git ${argumentList.join(' ')} failed: ${String(error)}`);
  }
}

async function resolveGitPath(checkoutPath: string, path: string): Promise<string> {
  const result = await runGit(checkoutPath, ['rev-parse', '--git-path', path]);
  if (result.exitCode !== 0) {
    throw new SkillsSetupError(
      `git rev-parse --git-path ${path} failed: ${result.standardError.trim() || `exit code ${result.exitCode}`}`,
    );
  }
  const output = result.standardOutput.trim();
  return isAbsolute(output) ? output : join(checkoutPath, output);
}

async function isIgnored(checkoutPath: string, relativePath: string): Promise<boolean> {
  const result = await runGit(checkoutPath, ['check-ignore', '-q', relativePath]);
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new SkillsSetupError(
      `git check-ignore ${relativePath} failed: ${result.standardError.trim() || `exit code ${result.exitCode}`}`,
    );
  }
  return result.exitCode === 0;
}
