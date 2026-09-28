export type CopyTargets = {
  readonly writeText: ((text: string) => Promise<void>) | undefined;
  readonly selectText: () => void;
};

export async function copyCommand(command: string, targets: CopyTargets): Promise<void> {
  if (targets.writeText === undefined) {
    targets.selectText();
    return;
  }
  try {
    await targets.writeText(command);
  } catch {
    targets.selectText();
  }
}
