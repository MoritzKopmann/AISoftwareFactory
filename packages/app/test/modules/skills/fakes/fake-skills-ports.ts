import type { CredentialSnapshot } from '../../../../src/modules/skills/logic/domain/types/credential-snapshot.js';
import type { CredentialSource } from '../../../../src/modules/skills/logic/ports/credential-source.js';
import type { SmokeProbeReport } from '../../../../src/modules/skills/logic/domain/types/smoke-probe-report.js';
import type { LocalPluginInstaller } from '../../../../src/modules/skills/logic/ports/local-plugin-installer.js';
import type { MarketplaceRegistry } from '../../../../src/modules/skills/logic/ports/marketplace-registry.js';
import type { PluginMirror } from '../../../../src/modules/skills/logic/ports/plugin-mirror.js';
import type { SlotReader } from '../../../../src/modules/skills/logic/ports/slot-reader.js';
import type { SmokeProbe } from '../../../../src/modules/skills/logic/ports/smoke-probe.js';

export class FakePluginMirror implements PluginMirror {
  replaceCount = 0;
  failure: Error | undefined;
  blocker: Promise<void> | undefined;

  async replace(): Promise<void> {
    this.replaceCount += 1;
    if (this.blocker !== undefined) {
      await this.blocker;
    }
    if (this.failure !== undefined) {
      throw this.failure;
    }
  }
}

export class FakeMarketplaceRegistry implements MarketplaceRegistry {
  registeredPaths: string[] = [];

  constructor(private currentPath: string | undefined) {}

  async registeredPath(): Promise<string | undefined> {
    return this.currentPath;
  }

  async register(path: string): Promise<void> {
    this.registeredPaths.push(path);
    this.currentPath = path;
  }
}

export class FakeLocalPluginInstaller implements LocalPluginInstaller {
  installCalls: string[] = [];
  failure: Error | undefined;

  async install(checkoutPath: string): Promise<void> {
    this.installCalls.push(checkoutPath);
    if (this.failure !== undefined) {
      throw this.failure;
    }
  }
}

export class FakeSmokeProbe implements SmokeProbe {
  runCount = 0;
  failure: Error | undefined;

  constructor(
    public report: SmokeProbeReport = {
      claudeCodeVersion: '2.1.283',
      skillNames: ['project-smoke', 'aisf:commit'],
    },
  ) {}

  async run(): Promise<SmokeProbeReport> {
    this.runCount += 1;
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.report;
  }
}

export class FakeCredentialSource implements CredentialSource {
  blocker: Promise<void> | undefined;

  constructor(
    public snapshot: CredentialSnapshot = { setEnvironmentVariables: [], apiKeyHelperFiles: [] },
  ) {}

  async read(): Promise<CredentialSnapshot> {
    if (this.blocker !== undefined) {
      await this.blocker;
    }
    return this.snapshot;
  }
}

export class FakeSlotReader implements SlotReader {
  constructor(private readonly slotTextsByPath = new Map<string, Map<string, string>>()) {}

  setSlotText(checkoutPath: string, slotName: string, text: string): void {
    const slotTexts = this.slotTextsByPath.get(checkoutPath) ?? new Map<string, string>();
    slotTexts.set(slotName, text);
    this.slotTextsByPath.set(checkoutPath, slotTexts);
  }

  async read(checkoutPath: string, slotName: string): Promise<string | undefined> {
    return this.slotTextsByPath.get(checkoutPath)?.get(slotName);
  }
}
