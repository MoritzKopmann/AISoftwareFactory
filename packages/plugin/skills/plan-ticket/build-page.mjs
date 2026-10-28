// Builds one round of the planning page. Usage: node build-page.mjs <ticketNumber> <roundNumber>
// Run from the worktree root. Writes only .aisf/artifacts/plan-<ticketNumber>/index.html.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACTS_DIRECTORY = join('.aisf', 'artifacts');
const PLAYBACK_OPEN_TAG = '<aisf-playback>';
const PLAYBACK_PATTERN = /<aisf-playback>[\s\S]*?<\/aisf-playback>/;
const BODY_CLOSE_TAG = '</body>';
const QUESTION_OPEN_TAG = '<aisf-question';
const JSON_INDENT = 2;

class BuildError extends Error {}

function main() {
  try {
    const [ticketNumber, roundNumber] = process.argv.slice(2);
    if (!ticketNumber || !roundNumber) throw new BuildError('usage: build-page.mjs <n> <N>');
    console.log(buildPage(ticketNumber, roundNumber));
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    console.log(error.message);
    process.exit(1);
  }
}

function buildPage(ticketNumber, roundNumber) {
  const planDirectory = join(ARTIFACTS_DIRECTORY, `plan-${ticketNumber}`);
  const pagePath = join(planDirectory, 'index.html');
  const plan = readJson(
    join(planDirectory, `round-${roundNumber}.json`),
    `round-${roundNumber}.json`,
  );
  const rows = plan.rows ?? [];
  const cards = readCards(planDirectory, plan.cards ?? []);
  const playback = readJson(join(planDirectory, 'playback.json'), 'playback.json');
  const round = roundElement(roundNumber, cards, rows);

  const html = existsSync(pagePath)
    ? updatePage(pagePath, roundNumber, round, playback)
    : createPage(planDirectory, ticketNumber, round, playback);

  writeFileSync(pagePath, html);
  return `page: ${pagePath} · round ${roundNumber} · ${cards.length} cards · ${rows.length} rows`;
}

function updatePage(pagePath, roundNumber, round, playback) {
  const html = readFileSync(pagePath, 'utf8');
  if (!html.includes(PLAYBACK_OPEN_TAG))
    throw new BuildError(`${pagePath} lacks ${PLAYBACK_OPEN_TAG}`);
  if (!html.includes(BODY_CLOSE_TAG)) throw new BuildError(`${pagePath} lacks ${BODY_CLOSE_TAG}`);

  const refreshed = html.replace(PLAYBACK_PATTERN, () => playbackElement(playback));
  const existingRound = new RegExp(`<aisf-round number="${roundNumber}">[\\s\\S]*?</aisf-round>`);
  return existingRound.test(refreshed)
    ? refreshed.replace(existingRound, () => round)
    : insertBeforeBodyEnd(refreshed, round);
}

function createPage(planDirectory, ticketNumber, round, playback) {
  const endState = readText(join(planDirectory, 'end-state.html'), 'end-state.html').trim();
  return insertBeforeBodyEnd(shell(ticketNumber, endState, playback), round);
}

function insertBeforeBodyEnd(html, round) {
  return html.replace(BODY_CLOSE_TAG, () => `${round}\n${BODY_CLOSE_TAG}`);
}

function shell(ticketNumber, endState, playback) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Plan ${ticketNumber}</title>
</head>
<body>
<section><span class="label">End state</span>
${endState}
</section>

${playbackElement(playback)}
${BODY_CLOSE_TAG}
</html>
`;
}

function playbackElement(playback) {
  const json = JSON.stringify(playback, null, JSON_INDENT).replaceAll('<', '\\u003c');
  return `${PLAYBACK_OPEN_TAG}\n<script type="application/json">\n${json}\n</script>\n</aisf-playback>`;
}

function roundElement(roundNumber, cards, rows) {
  const precedent =
    rows.length > 0 ? `<aisf-precedent>\n${rows.join('\n')}\n</aisf-precedent>\n` : '';
  return `<aisf-round number="${roundNumber}">\n${cards.join('')}${precedent}</aisf-round>`;
}

function readCards(planDirectory, names) {
  return names.map((name) => {
    const file = join(planDirectory, 'questions', `${name}.html`);
    const html = readText(file, `card "${name}"`);
    if (!html.trimStart().startsWith(QUESTION_OPEN_TAG)) {
      throw new BuildError(`card "${name}" does not start with ${QUESTION_OPEN_TAG}: ${file}`);
    }
    return html.endsWith('\n') ? html : `${html}\n`;
  });
}

function readJson(file, description) {
  const text = readText(file, description);
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new BuildError(`${description} is not valid JSON: ${file}`);
  }
}

function readText(file, description) {
  if (!existsSync(file)) throw new BuildError(`${description} is missing: ${file}`);
  return readFileSync(file, 'utf8');
}

main();
