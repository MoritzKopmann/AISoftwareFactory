import type { SmokeProbeReport } from '../../../../src/modules/skills/logic/domain/smoke-probe-report.js';
import type { MarketplaceRegistry } from '../../../../src/modules/skills/logic/ports/marketplace-registry.js';
import type { PluginMirror } from '../../../../src/modules/skills/logic/ports/plugin-mirror.js';
import type { SmokeProbe } from '../../../../src/modules/skills/logic/ports/smoke-probe.js';

export class FakePluginMirror implements PluginMirror {
  replaceCount = 0;
  failure: Error | undefined;

  async replace(): Promise<void> {
    this.replaceCount += 1;
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
