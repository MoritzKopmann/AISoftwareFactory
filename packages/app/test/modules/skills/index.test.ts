import { describe, expect, it } from 'vitest';
import { createSkillsModule } from '../../../src/modules/skills/index.js';
import { SkillsSetupError } from '../../../src/modules/skills/logic/errors/skills-setup-error.js';
import {
  FakeCredentialSource,
  FakeLocalPluginInstaller,
  FakeMarketplaceRegistry,
  FakePluginMirror,
  FakeSlotReader,
  FakeSmokeProbe,
} from './fakes/fake-skills-ports.js';

const mirrorDirectory = '/home/user/.aisf/plugins/aisf';

function createSubject() {
  const smokeProbe = new FakeSmokeProbe();
  const slotReader = new FakeSlotReader();
  const localPluginInstaller = new FakeLocalPluginInstaller();
  const credentialSource = new FakeCredentialSource();
  const skills = createSkillsModule({
    pluginMirror: new FakePluginMirror(),
    marketplaceRegistry: new FakeMarketplaceRegistry(mirrorDirectory),
    smokeProbe,
    mirrorDirectory,
    slotReader,
    localPluginInstaller,
    credentialSource,
  });
  return { skills, smokeProbe, slotReader, localPluginInstaller, credentialSource };
}

describe('createSkillsModule', () => {
  describe('runsBlocked', () => {
    it('should block runs when start-up has not finished', () => {
      const { skills } = createSubject();

      expect(skills.runsBlocked()).toEqual({
        blocked: true,
        reason: 'Skills start-up checks have not finished',
      });
    });

    it('should not block runs when the smoke test passed', async () => {
      const { skills } = createSubject();

      await skills.start();

      expect(skills.runsBlocked()).toEqual({ blocked: false });
    });

    it('should block runs with the reason when the smoke test failed', async () => {
      const { skills, smokeProbe } = createSubject();
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');

      await skills.start();

      expect(skills.runsBlocked()).toEqual({ blocked: true, reason: 'claude exited with code 1' });
    });

    it('should block runs naming the variable when a non-subscription credential is set', async () => {
      const { skills, credentialSource } = createSubject();
      credentialSource.snapshot = {
        setEnvironmentVariables: ['ANTHROPIC_API_KEY'],
        apiKeyHelperFiles: [],
      };

      await skills.start();

      expect(skills.runsBlocked()).toEqual({
        blocked: true,
        reason: 'Runs would bill ANTHROPIC_API_KEY, not your Claude login. Unset it to run.',
      });
    });

    it('should not block runs when only CLAUDE_CODE_OAUTH_TOKEN is set', async () => {
      const { skills, credentialSource } = createSubject();
      credentialSource.snapshot = {
        setEnvironmentVariables: ['CLAUDE_CODE_OAUTH_TOKEN'],
        apiKeyHelperFiles: [],
      };

      await skills.start();

      expect(skills.runsBlocked()).toEqual({ blocked: false });
    });
  });

  describe('status', () => {
    it('should report pending when start-up has not finished', () => {
      const { skills } = createSubject();

      expect(skills.status()).toEqual({ state: 'pending' });
    });

    it('should report the failure reason when the smoke test failed', async () => {
      const { skills, smokeProbe } = createSubject();
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');
      await skills.start();

      expect(skills.status()).toEqual({
        state: 'failed',
        reason: 'claude exited with code 1',
      });
    });
  });

  describe('runContractPreflight', () => {
    it('should report every required slot as missing when the checkout has none of them', async () => {
      const { skills } = createSubject();

      const report = await skills.runContractPreflight('/home/user/repo');

      expect(report.passed).toBe(false);
      expect(report.missingSlots).toEqual([
        'project-architecture',
        'project-testing',
        'project-toolchain',
      ]);
    });
  });

  describe('installPluginLocally', () => {
    const checkoutPath = '/home/user/repo';

    it('should install directly when start-up has not been called', async () => {
      const { skills, localPluginInstaller } = createSubject();

      expect(await skills.installPluginLocally(checkoutPath)).toEqual({ state: 'installed' });
      expect(localPluginInstaller.installCalls).toEqual([checkoutPath]);
    });

    it('should wait for an in-flight start-up before installing', async () => {
      const localPluginInstaller = new FakeLocalPluginInstaller();
      const pluginMirror = new FakePluginMirror();
      let releaseStart: () => void = () => {};
      pluginMirror.blocker = new Promise((resolve) => {
        releaseStart = resolve;
      });
      const blockedSkills = createSkillsModule({
        pluginMirror,
        marketplaceRegistry: new FakeMarketplaceRegistry(mirrorDirectory),
        smokeProbe: new FakeSmokeProbe(),
        mirrorDirectory,
        slotReader: new FakeSlotReader(),
        localPluginInstaller,
        credentialSource: new FakeCredentialSource(),
      });

      const startPromise = blockedSkills.start();
      const installPromise = blockedSkills.installPluginLocally(checkoutPath);

      expect(localPluginInstaller.installCalls).toEqual([]);
      releaseStart();
      await startPromise;
      expect(await installPromise).toEqual({ state: 'installed' });
      expect(localPluginInstaller.installCalls).toEqual([checkoutPath]);
    });

    it('should return the failure reason when the installer fails', async () => {
      const { skills, localPluginInstaller } = createSubject();
      localPluginInstaller.failure = new SkillsSetupError('claude plugin install failed');

      expect(await skills.installPluginLocally(checkoutPath)).toEqual({
        state: 'failed',
        reason: 'claude plugin install failed',
      });
    });
  });
});
