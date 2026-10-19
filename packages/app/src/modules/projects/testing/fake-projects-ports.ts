import type { CheckoutFetcher } from '../business/port/checkout/checkout-fetcher.js';
import type { ContractPreflightReport } from '../business/domain/types/contract-preflight-report.js';
import type { PluginInstallResult } from '../business/domain/types/plugin-install-result.js';
import type { Project } from '../business/domain/types/project.js';
import type { LabelSync } from '../business/port/github/label-sync.js';
import type { SkillPort } from '../business/port/skill/skill-port.js';
import type { ProjectRepository } from '../business/port/repository/project-repository.js';
import type {
  RepositoryReference,
  RepositoryResolver,
} from '../business/port/github/repository-resolver.js';

const passingReport: ContractPreflightReport = {
  passed: true,
  missingSlots: [],
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

  async setPaused(id: string, paused: boolean): Promise<void> {
    const project = this.projectsById.get(id);
    if (project !== undefined) {
      this.projectsById.set(id, { ...project, paused });
    }
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

export class FakeSkillPort implements SkillPort {
  installCalls: string[] = [];
  result: PluginInstallResult = { state: 'installed' };
  checkCalls: string[] = [];

  constructor(private readonly reportsByPath = new Map<string, ContractPreflightReport>()) {}

  setReport(checkoutPath: string, report: ContractPreflightReport): void {
    this.reportsByPath.set(checkoutPath, report);
  }

  async check(checkoutPath: string): Promise<ContractPreflightReport> {
    this.checkCalls.push(checkoutPath);
    return this.reportsByPath.get(checkoutPath) ?? passingReport;
  }

  async install(checkoutPath: string): Promise<PluginInstallResult> {
    this.installCalls.push(checkoutPath);
    return this.result;
  }
}

export class FakeCheckoutFetcher implements CheckoutFetcher {
  fetchCalls: string[] = [];
  failure: Error | undefined;

  async fetch(checkoutPath: string): Promise<void> {
    this.fetchCalls.push(checkoutPath);
    if (this.failure !== undefined) {
      throw this.failure;
    }
  }
}
