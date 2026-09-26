import { access, cp, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SkillsSetupError } from '../../logic/errors/skills-setup-error.js';
import type { PluginMirror } from '../../logic/ports/plugin-mirror.js';

export type FileSystemPluginMirrorOptions = {
  readonly sourceDirectory: string;
  readonly mirrorDirectory: string;
};

export class FileSystemPluginMirror implements PluginMirror {
  constructor(private readonly options: FileSystemPluginMirrorOptions) {}

  async replace(): Promise<void> {
    const { sourceDirectory, mirrorDirectory } = this.options;
    try {
      await access(sourceDirectory);
      await rm(mirrorDirectory, { recursive: true, force: true });
      await mkdir(dirname(mirrorDirectory), { recursive: true });
      await cp(sourceDirectory, mirrorDirectory, { recursive: true });
    } catch (error) {
      throw new SkillsSetupError(
        `Cannot mirror the aisf plugin into ${mirrorDirectory}: ${String(error)}`,
      );
    }
  }
}
