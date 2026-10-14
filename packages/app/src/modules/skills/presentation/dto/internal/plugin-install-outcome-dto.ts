export type PluginInstallOutcomeDto =
  { readonly state: 'installed' } | { readonly state: 'failed'; readonly reason: string };
