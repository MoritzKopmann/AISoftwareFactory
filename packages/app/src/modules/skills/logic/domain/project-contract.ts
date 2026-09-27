export type ContractSlot =
  | {
      readonly kind: 'headings';
      readonly name: string;
      readonly requiredHeadings: ReadonlyArray<string>;
    }
  | {
      readonly kind: 'toolchain';
      readonly name: string;
      readonly requiredKeys: ReadonlyArray<string>;
    };

export type ProjectContract = {
  readonly slots: ReadonlyArray<ContractSlot>;
};

export const projectContract: ProjectContract = {
  slots: [
    {
      kind: 'headings',
      name: 'project-architecture',
      requiredHeadings: [
        '## Stack',
        '## Module layout',
        '## Placement rules',
        '## Hard bans',
        '## Plan vocabulary',
        '## UI',
        '## Easy-to-miss wiring',
        '## Load also',
      ],
    },
    {
      kind: 'headings',
      name: 'project-testing',
      requiredHeadings: [
        '## Mechanics',
        '## Layout and naming',
        '## Fakes and fixtures',
        '## Load also',
      ],
    },
    {
      kind: 'toolchain',
      name: 'project-toolchain',
      requiredKeys: [
        'format',
        'analyze',
        'test',
        'test_file',
        'manifests',
        'registry',
        'platforms',
      ],
    },
  ],
};
