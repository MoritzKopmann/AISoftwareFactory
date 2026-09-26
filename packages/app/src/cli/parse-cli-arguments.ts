export type CliOptions = {
  readonly openBrowser: boolean;
};

export function parseCliArguments(argumentList: ReadonlyArray<string>): CliOptions {
  return { openBrowser: !argumentList.includes('--no-open') };
}
