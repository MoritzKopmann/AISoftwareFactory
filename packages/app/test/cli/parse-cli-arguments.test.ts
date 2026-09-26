import { describe, expect, it } from 'vitest';
import { parseCliArguments } from '../../src/cli/parse-cli-arguments.js';

describe('parseCliArguments', () => {
  it('should open the browser when no flag is given', () => {
    expect(parseCliArguments([])).toEqual({ openBrowser: true });
  });

  it('should skip opening the browser when --no-open is given', () => {
    expect(parseCliArguments(['--no-open'])).toEqual({ openBrowser: false });
  });
});
