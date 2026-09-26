const minimumNodeMajorVersion = 22;
const requiredCommands = ['gh', 'claude'];

export type PreflightProbe = {
  readonly nodeVersion: string;
  readonly isOnPath: (command: string) => boolean;
};

export function findPreflightProblems(probe: PreflightProbe): ReadonlyArray<string> {
  const problems: string[] = [];

  const nodeMajorVersion = Number.parseInt(probe.nodeVersion, 10);
  if (nodeMajorVersion < minimumNodeMajorVersion) {
    problems.push(
      `Node ${minimumNodeMajorVersion} or newer is required, found ${probe.nodeVersion}`,
    );
  }

  for (const command of requiredCommands) {
    if (!probe.isOnPath(command)) {
      problems.push(`${command} was not found on PATH`);
    }
  }

  return problems;
}
