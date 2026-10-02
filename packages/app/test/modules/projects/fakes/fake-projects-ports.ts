import type { ContractPreflightReport } from '../../../../src/modules/projects/logic/domain/types/contract-preflight-report.js';
import type { PluginInstallResult } from '../../../../src/modules/projects/logic/domain/types/plugin-install-result.js';
import type { Project } from '../../../../src/modules/projects/logic/domain/types/project.js';
import type { ContractPreflight } from '../../../../src/modules/projects/logic/ports/contract-preflight.js';
import type { LabelSync } from '../../../../src/modules/projects/logic/ports/label-sync.js';
import type { PluginInstaller } from '../../../../src/modules/projects/logic/ports/plugin-installer.js';
import type { ProjectRepository } from '../../../../src/modules/projects/logic/ports/project-repository.js';
import type {
  RepositoryReference,
  RepositoryResolver,
} from '../../../../src/modules/projects/logic/ports/repository-resolver.js';

const passingReport: ContractPreflightReport = {
  passed: true,
  missingSlots: [],
  missingHeadings: [],
  missingKeys: [],
};

export class FakeRepositoryResolver implements RepositoryResolver {
  resolveCalls: string[] = [];
  failure: Error | undefined;

  constructor(private reference: RepositoryReference) {}

  async resolve(checkoutPath: string): Promise<RepositoryReference> {
    this.resolveCalls.push(checkoutPath);
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.reference;
  }
}

export class FakeProjectRepository implements ProjectRepository {
  private readonly projectsById = new Map<string, Project>();

  async findById(id: string): Promise<Project | undefined> {
    return this.projectsById.get(id);
  }

  async list(): Promise<ReadonlyArray<Project>> {
    return [...this.projectsById.values()];
  }

  async save(project: Project): Promise<void> {
    this.projectsById.set(project.id, project);
  }
}

export class FakeLabelSync implements LabelSync {
  syncCalls: RepositoryReference[] = [];
  failure: Error | undefined;
  private readonly failuresByRepository = new Map<string, Error>();

  setFailure(repository: RepositoryReference, failure: Error): void {
    this.failuresByRepository.set(`${repository.owner}/${repository.name}`, failure);
  }

  async sync(repository: RepositoryReference): Promise<void> {
    this.syncCalls.push(repository);
    const failure =
      this.failure ?? this.failuresByRepository.get(`${repository.owner}/${repository.name}`);
    if (failure !== undefined) {
      throw failure;
    }
  }
}

export class FakePluginInstaller implements PluginInstaller {
  installCalls: string[] = [];
  result: PluginInstallResult = { state: 'installed' };

  async install(checkoutPath: string): Promise<PluginInstallResult> {
    this.installCalls.push(checkoutPath);
    return this.result;
  }
}

export class FakeContractPreflight implements ContractPreflight {
  checkCalls: string[] = [];

  constructor(private readonly reportsByPath = new Map<string, ContractPreflightReport>()) {}

  setReport(checkoutPath: string, report: ContractPreflightReport): void {
    this.reportsByPath.set(checkoutPath, report);
  }

  async check(checkoutPath: string): Promise<ContractPreflightReport> {
    this.checkCalls.push(checkoutPath);
    return this.reportsByPath.get(checkoutPath) ?? passingReport;
  }
}
