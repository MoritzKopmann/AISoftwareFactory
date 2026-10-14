import { describe, expect, it } from 'vitest';
import { FakeEventPublisher } from '../../shared/testing/fake-event-publisher.js';
import type { SkillsModule } from './presentation/internal/skills-module.js';
import { createSkillsModule } from './index.js';
import { SkillsSetupError } from './business/errors/skills-setup-error.js';
import {
  FakeCredentialSource,
  FakeLocalPluginInstaller,
  FakeMarketplaceRegistry,
  FakePluginMirror,
  FakeSlotReader,
  FakeSkillsStatusRepository,
  FakeSmokeProbe,
} from './testing/fake-skills-ports.js';

const mirrorDirectory = '/home/user/.aisf/plugins/aisf';
const startUpChecks = 'skills.start-up-checks';

async function runStartUpChecks(skills: SkillsModule): Promise<void> {
  await skills.jobs[startUpChecks]?.();
}

function createDependencies(events: FakeEventPublisher, loggedErrors: string[]) {
  return {
    events,
    logger: {
      info: () => {},
      warn: () => {},
      error: (message: string) => loggedErrors.push(message),
    },
    pluginDirectory: '/home/user/plugin',
    mirrorDirectory,
    probeDirectory: '/home/user/.aisf/probe',
    environment: {},
    projectDirectory: '/home/user/repo',
  };
}

function createSubject() {
  const smokeProbe = new FakeSmokeProbe();
  const slotReader = new FakeSlotReader();
  const localPluginInstaller = new FakeLocalPluginInstaller();
  const credentialSource = new FakeCredentialSource();
  const statusRepository = new FakeSkillsStatusRepository();
  const loggedErrors: string[] = [];
  const skills = createSkillsModule(createDependencies(new FakeEventPublisher(), loggedErrors), {
    pluginMirror: new FakePluginMirror(),
    marketplaceRegistry: new FakeMarketplaceRegistry(mirrorDirectory),
    smokeProbe,
    slotReader,
    localPluginInstaller,
    credentialSource,
    statusRepository,
  });
  return {
    skills,
    smokeProbe,
    slotReader,
    localPluginInstaller,
    credentialSource,
    statusRepository,
    loggedErrors,
  };
}

describe('skills module', () => {
  describe('runsBlocked', () => {
    it('should block runs when start-up has not finished', () => {
      const { skills } = createSubject();

      expect(skills.internal.runsBlocked()).toEqual({
        blocked: true,
        reason: 'Skills start-up checks have not finished',
      });
    });

    it('should not block runs when the smoke test passed', async () => {
      const { skills } = createSubject();

      await runStartUpChecks(skills);

      expect(skills.internal.runsBlocked()).toEqual({ blocked: false });
    });

    it('should block runs with the reason when the smoke test failed', async () => {
      const { skills, smokeProbe } = createSubject();
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');

      await runStartUpChecks(skills);

      expect(skills.internal.runsBlocked()).toEqual({
        blocked: true,
        reason: 'claude exited with code 1',
      });
    });

    it('should block runs naming the variable when a non-subscription credential is set', async () => {
      const { skills, credentialSource } = createSubject();
      credentialSource.snapshot = {
        setEnvironmentVariables: ['ANTHROPIC_API_KEY'],
        apiKeyHelperFiles: [],
      };

      await runStartUpChecks(skills);

      expect(skills.internal.runsBlocked()).toEqual({
        blocked: true,
        reason: 'Runs would bill ANTHROPIC_API_KEY, not your Claude login. Unset it to run.',
      });
    });

    it('should return the reason determineRunsBlocked gives when the store holds a failed status', () => {
      const { skills, statusRepository } = createSubject();
      statusRepository.save(
        { state: 'failed', reason: 'probe broke' },
        { setEnvironmentVariables: [], apiKeyHelperFiles: [] },
      );

      expect(skills.internal.runsBlocked()).toEqual({ blocked: true, reason: 'probe broke' });
    });

    it('should not block runs when only CLAUDE_CODE_OAUTH_TOKEN is set', async () => {
      const { skills, credentialSource } = createSubject();
      credentialSource.snapshot = {
        setEnvironmentVariables: ['CLAUDE_CODE_OAUTH_TOKEN'],
        apiKeyHelperFiles: [],
      };

      await runStartUpChecks(skills);

      expect(skills.internal.runsBlocked()).toEqual({ blocked: false });
    });
  });

  describe('job skills.start-up-checks', () => {
    it('should log the reason when the checks leave runs blocked', async () => {
      const { skills, smokeProbe, loggedErrors } = createSubject();
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');

      await runStartUpChecks(skills);

      expect(loggedErrors).toEqual(['Runs are blocked: claude exited with code 1']);
    });

    it('should log nothing when the checks pass', async () => {
      const { skills, loggedErrors } = createSubject();

      await runStartUpChecks(skills);

      expect(loggedErrors).toEqual([]);
    });

    it('should be the only job when the module is built', () => {
      const { skills } = createSubject();

      expect(Object.keys(skills.jobs)).toEqual([startUpChecks]);
    });
  });

  describe('status', () => {
    it('should serve pending under /api/skills/status when start-up has not finished', async () => {
      const { skills } = createSubject();

      const response = await skills.routes.request('/api/skills/status');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ state: 'pending' });
    });

    it('should serve the failure reason under /api/skills/status when the smoke test failed', async () => {
      const { skills, smokeProbe } = createSubject();
      smokeProbe.failure = new SkillsSetupError('claude exited with code 1');
      await runStartUpChecks(skills);

      const response = await skills.routes.request('/api/skills/status');

      expect(await response.json()).toEqual({
        state: 'failed',
        reason: 'claude exited with code 1',
      });
    });
  });

  describe('runContractPreflight', () => {
    it('should report every required slot as missing when the checkout has none of them', async () => {
      const { skills } = createSubject();

      const report = await skills.internal.runContractPreflight('/home/user/repo');

      expect(report.passed).toBe(false);
      expect(report.missingSlots).toEqual([
        'project-architecture',
        'code-rules',
        'project-testing',
        'project-toolchain',
      ]);
    });
  });

  describe('runContractPreflight with the real slot reader', () => {
    it("should pass for this repository's own checkout", async () => {
      const skills = createSkillsModule(createDependencies(new FakeEventPublisher(), []));

      expect(await skills.internal.runContractPreflight(process.cwd())).toEqual({
        passed: true,
        missingSlots: [],
        missingKeys: [],
      });
    });
  });

  describe('installPluginLocally', () => {
    const checkoutPath = '/home/user/repo';

    it('should install directly when start-up has not been called', async () => {
      const { skills, localPluginInstaller } = createSubject();

      expect(await skills.internal.installPluginLocally(checkoutPath)).toEqual({
        state: 'installed',
      });
      expect(localPluginInstaller.installCalls).toEqual([checkoutPath]);
    });

    it('should wait for an in-flight start-up before installing', async () => {
      const localPluginInstaller = new FakeLocalPluginInstaller();
      const pluginMirror = new FakePluginMirror();
      let releaseStart: () => void = () => {};
      pluginMirror.blocker = new Promise<void>((resolve) => {
        releaseStart = resolve;
      });
      const blockedSkills = createSkillsModule(createDependencies(new FakeEventPublisher(), []), {
        pluginMirror,
        marketplaceRegistry: new FakeMarketplaceRegistry(mirrorDirectory),
        smokeProbe: new FakeSmokeProbe(),
        slotReader: new FakeSlotReader(),
        localPluginInstaller,
        credentialSource: new FakeCredentialSource(),
        statusRepository: new FakeSkillsStatusRepository(),
      });

      const startPromise = blockedSkills.jobs[startUpChecks]?.();
      const installPromise = blockedSkills.internal.installPluginLocally(checkoutPath);

      expect(localPluginInstaller.installCalls).toEqual([]);
      releaseStart();
      await startPromise;
      expect(await installPromise).toEqual({ state: 'installed' });
      expect(localPluginInstaller.installCalls).toEqual([checkoutPath]);
    });

    it('should return the failure reason when the installer fails', async () => {
      const { skills, localPluginInstaller } = createSubject();
      localPluginInstaller.failure = new SkillsSetupError('claude plugin install failed');

      expect(await skills.internal.installPluginLocally(checkoutPath)).toEqual({
        state: 'failed',
        reason: 'claude plugin install failed',
      });
    });
  });
});
