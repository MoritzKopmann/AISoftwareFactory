import { runProcess } from '../../../../shared/process/run-process.js';
import { SkillsSetupError } from '../../logic/errors/skills-setup-error.js';

export type RunClaudeOptions = {
  readonly workingDirectory?: string;
  readonly timeoutMilliseconds: number;
};

export async function runClaude(
  argumentList: ReadonlyArray<string>,
  options: RunClaudeOptions,
): Promise<string> {
  let result;
  try {
    result = await runProcess('claude', argumentList, options);
  } catch (error) {
    throw new SkillsSetupError(`claude ${argumentList.join(' ')} failed: ${String(error)}`);
  }
  if (result.exitCode !== 0) {
    const detail = result.standardError.trim() || `exit code ${result.exitCode}`;
    throw new SkillsSetupError(`claude ${argumentList.join(' ')} failed: ${detail}`);
  }
  return result.standardOutput;
}
