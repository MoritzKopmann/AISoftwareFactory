export type ContractSlot =
  | { readonly kind: 'skill'; readonly name: string }
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
    { kind: 'skill', name: 'project-architecture' },
    { kind: 'skill', name: 'code-rules' },
    { kind: 'skill', name: 'project-testing' },
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
