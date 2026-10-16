import { describe, expect, it } from 'vitest';
import { PluginInstallFailedError } from '../errors/plugin-install-failed-error.js';
import { ProjectAlreadyAddedError } from '../errors/project-already-added-error.js';
import { ProjectService } from './project-service.js';
import { FakeClock } from '../../../../shared/testing/fake-clock.js';
import { FakeEventPublisher } from '../../../../shared/testing/fake-event-publisher.js';
import {
  FakeLabelSync,
  FakeSkillPort,
  FakeProjectRepository,
  FakeRepositoryResolver,
} from '../../testing/fake-projects-ports.js';

const checkoutPath = '/home/user/repo';
const reference = { owner: 'moritz', name: 'aisf' };
const addedAt = '2026-09-27T00:00:00.000Z';

function createSubject() {
  const repositoryResolver = new FakeRepositoryResolver(reference);
  const projectRepository = new FakeProjectRepository();
  const labelSync = new FakeLabelSync();
  const skillPort = new FakeSkillPort();
  const clock = new FakeClock(addedAt);
  const events = new FakeEventPublisher();
  const service = new ProjectService({
    repositoryResolver,
    projectRepository,
    labelSync,
    skillPort,
    clock,
    events,
  });
  return {
    service,
    repositoryResolver,
    projectRepository,
    labelSync,
    skillPort,
    clock,
    events,
  };
}

describe('ProjectService', () => {
  describe('add', () => {
    it('should save the project with an id from the resolved repository', async () => {
      const { service, projectRepository } = createSubject();

      const project = await service.add(checkoutPath);

      expect(project).toEqual({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath,
        addedAt,
      });
      expect(await projectRepository.findById('moritz/aisf')).toEqual(project);
    });

    it('should emit project.added when the project is saved', async () => {
      const { service, events } = createSubject();

      const project = await service.add(checkoutPath);

      expect(events.emittedEvents).toEqual([
        {
          name: 'project.added',
          payload: {
            projectId: project.id,
            repository: project.repository,
            checkoutPath: project.checkoutPath,
          },
        },
      ]);
    });

    it('should sync labels for the resolved repository before saving', async () => {
      const { service, labelSync } = createSubject();

      await service.add(checkoutPath);

      expect(labelSync.syncCalls).toEqual([reference]);
    });

    it('should throw the label sync failure without saving or emitting', async () => {
      const { service, labelSync, projectRepository, events } = createSubject();
      labelSync.failure = new Error('gh label create failed');

      await expect(service.add(checkoutPath)).rejects.toThrow('gh label create failed');

      expect(await projectRepository.list()).toEqual([]);
      expect(events.emittedEvents).toEqual([]);
    });

    it('should not sync labels when the repository is already added', async () => {
      const { service, labelSync, projectRepository } = createSubject();
      await projectRepository.save({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath: '/some/other/path',
        addedAt,
      });

      await expect(service.add(checkoutPath)).rejects.toThrow(ProjectAlreadyAddedError);

      expect(labelSync.syncCalls).toEqual([]);
    });

    it('should throw ProjectAlreadyAddedError when the resolved repository is already saved', async () => {
      const { service, projectRepository } = createSubject();
      await projectRepository.save({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath: '/some/other/path',
        addedAt,
      });

      await expect(service.add(checkoutPath)).rejects.toThrow(ProjectAlreadyAddedError);
    });

    it('should leave the project list unchanged when the repository is already added', async () => {
      const { service, projectRepository } = createSubject();
      await projectRepository.save({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath: '/some/other/path',
        addedAt,
      });

      await expect(service.add(checkoutPath)).rejects.toThrow(ProjectAlreadyAddedError);

      expect(await projectRepository.list()).toHaveLength(1);
    });

    it('should install the plugin at the checkout path after syncing labels', async () => {
      const { service, skillPort } = createSubject();

      await service.add(checkoutPath);

      expect(skillPort.installCalls).toEqual([checkoutPath]);
    });

    it('should throw PluginInstallFailedError with the reason and not save when install fails', async () => {
      const { service, skillPort, projectRepository, events } = createSubject();
      skillPort.result = { state: 'failed', reason: 'claude plugin install failed' };

      await expect(service.add(checkoutPath)).rejects.toThrow(PluginInstallFailedError);
      await expect(service.add(checkoutPath)).rejects.toThrow('claude plugin install failed');

      expect(await projectRepository.list()).toEqual([]);
      expect(events.emittedEvents).toEqual([]);
    });

    it('should not install the plugin when the repository is already added', async () => {
      const { service, skillPort, projectRepository } = createSubject();
      await projectRepository.save({
        id: 'moritz/aisf',
        repository: reference,
        checkoutPath: '/some/other/path',
        addedAt,
      });

      await expect(service.add(checkoutPath)).rejects.toThrow(ProjectAlreadyAddedError);

      expect(skillPort.installCalls).toEqual([]);
    });

    it('should propagate a resolver failure without saving or emitting', async () => {
      const { service, repositoryResolver, projectRepository, events } = createSubject();
      repositoryResolver.failure = new Error('not a checkout');

      await expect(service.add(checkoutPath)).rejects.toThrow('not a checkout');

      expect(await projectRepository.list()).toEqual([]);
      expect(events.emittedEvents).toEqual([]);
    });
  });

  describe('list', () => {
    const failingReport = {
      passed: false,
      missingSlots: ['project-architecture'],
      missingKeys: [],
    };
    const savedProject = {
      id: 'moritz/aisf',
      repository: reference,
      checkoutPath,
      addedAt,
    };

    it('should return every saved project with its freshly computed contract report when listing', async () => {
      const { service, projectRepository, skillPort } = createSubject();
      await projectRepository.save(savedProject);
      skillPort.setReport(checkoutPath, failingReport);

      expect(await service.list()).toEqual([{ ...savedProject, contract: failingReport }]);
      expect(skillPort.checkCalls).toEqual([checkoutPath]);
    });

    it('should return an empty list when nothing has been saved', async () => {
      const { service } = createSubject();

      expect(await service.list()).toEqual([]);
    });

    it('should recompute the contract report on every call when listing again', async () => {
      const { service, projectRepository, skillPort } = createSubject();
      await projectRepository.save(savedProject);
      skillPort.setReport(checkoutPath, failingReport);

      const [firstListing] = await service.list();
      skillPort.setReport(checkoutPath, {
        passed: true,
        missingSlots: [],
        missingKeys: [],
      });
      const [secondListing] = await service.list();

      expect(firstListing?.contract).toEqual(failingReport);
      expect(secondListing?.contract.passed).toBe(true);
    });
  });
});
