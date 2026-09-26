import { SkillsSetupError } from '../../logic/errors/skills-setup-error.js';
import type { MarketplaceRegistry } from '../../logic/ports/marketplace-registry.js';
import { runClaude } from './run-claude.js';

const marketplaceName = 'aisf';
const commandTimeoutMilliseconds = 60_000;

type ListedMarketplace = { readonly name?: string; readonly path?: string };

export class ClaudeCliMarketplaceRegistry implements MarketplaceRegistry {
  async registeredPath(): Promise<string | undefined> {
    const output = await runClaude(['plugin', 'marketplace', 'list', '--json'], {
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
    let marketplaces: unknown;
    try {
      marketplaces = JSON.parse(output);
    } catch {
      marketplaces = undefined;
    }
    if (!Array.isArray(marketplaces)) {
      throw new SkillsSetupError('claude plugin marketplace list returned unreadable output');
    }
    return (marketplaces as ReadonlyArray<ListedMarketplace>).find(
      (marketplace) => marketplace.name === marketplaceName,
    )?.path;
  }

  async register(path: string): Promise<void> {
    // Adding a marketplace under an existing name re-points it and keeps installed plugins.
    await runClaude(['plugin', 'marketplace', 'add', path], {
      timeoutMilliseconds: commandTimeoutMilliseconds,
    });
  }
}
