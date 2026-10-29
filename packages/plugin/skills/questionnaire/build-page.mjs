// Builds one round of a bridge page. Usage: node build-page.mjs <page-id> <roundNumber>
// Run from the worktree root. Writes only .aisf/artifacts/<page-id>/index.html.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACTS_DIRECTORY = join('.aisf', 'artifacts');
const HEADER_OPEN = '<!-- aisf-header -->';
const HEADER_CLOSE = '<!-- /aisf-header -->';
const HEADER_PATTERN = new RegExp(`${HEADER_OPEN}[\\s\\S]*?${HEADER_CLOSE}\\n?`);
const BODY_OPEN_PATTERN = /<body[^>]*>\n?/;
const BODY_CLOSE_TAG = '</body>';
const QUESTION_OPEN_TAG = '<aisf-question';

class BuildError extends Error {}

function main() {
  try {
    const [pageId, roundNumber] = process.argv.slice(2);
    if (!pageId || !roundNumber) throw new BuildError('usage: build-page.mjs <page-id> <N>');
    console.log(buildPage(pageId, roundNumber));
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    console.log(error.message);
    process.exit(1);
  }
}

function buildPage(pageId, roundNumber) {
  const pageDirectory = join(ARTIFACTS_DIRECTORY, pageId);
  const pagePath = join(pageDirectory, 'index.html');
  const plan = readJson(
    join(pageDirectory, `round-${roundNumber}.json`),
    `round-${roundNumber}.json`,
  );
  if (mixesConfirmWithQuestions(plan)) {
    throw new BuildError(`round-${roundNumber}.json mixes confirm with cards or rows`);
  }
  const rows = plan.rows ?? [];
  const cards = readCards(pageDirectory, plan.cards ?? []);
  const header = readHeader(pageDirectory);
  const round = plan.confirm
    ? confirmRoundElement(roundNumber, plan.confirm, pageDirectory)
    : roundElement(roundNumber, cards, rows);

  const html = existsSync(pagePath)
    ? updatePage(pagePath, roundNumber, round, header)
    : insertBeforeBodyEnd(shell(pageId, header), round);

  writeFileSync(pagePath, html);
  return `page: ${pagePath} · round ${roundNumber} · ${cards.length} cards · ${rows.length} rows`;
}

function mixesConfirmWithQuestions(plan) {
  return Boolean(plan.confirm && (plan.cards || plan.rows));
}

function readHeader(pageDirectory) {
  const file = join(pageDirectory, 'header.html');
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
}

function headerRegion(header) {
  return header === '' ? '' : `${HEADER_OPEN}\n${header}\n${HEADER_CLOSE}\n`;
}

function updatePage(pagePath, roundNumber, round, header) {
  const html = readFileSync(pagePath, 'utf8');
  if (!html.includes(BODY_CLOSE_TAG)) throw new BuildError(`${pagePath} lacks ${BODY_CLOSE_TAG}`);

  const withoutHeader = html.replace(HEADER_PATTERN, '');
  const refreshed = withoutHeader.replace(
    BODY_OPEN_PATTERN,
    (open) => `${open}${headerRegion(header)}`,
  );
  const existingRound = new RegExp(`<aisf-round number="${roundNumber}">[\\s\\S]*?</aisf-round>`);
  return existingRound.test(refreshed)
    ? refreshed.replace(existingRound, () => round)
    : insertBeforeBodyEnd(refreshed, round);
}

function insertBeforeBodyEnd(html, round) {
  return html.replace(BODY_CLOSE_TAG, () => `${round}\n${BODY_CLOSE_TAG}`);
}

function shell(pageId, header) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${pageId}</title>
</head>
<body>
${headerRegion(header)}${BODY_CLOSE_TAG}
</html>
`;
}

function roundElement(roundNumber, cards, rows) {
  const precedent =
    rows.length > 0 ? `<aisf-precedent>\n${rows.join('\n')}\n</aisf-precedent>\n` : '';
  return `<aisf-round number="${roundNumber}">\n${cards.join('')}${precedent}</aisf-round>`;
}

function confirmRoundElement(roundNumber, confirm, pageDirectory) {
  const lines = (confirm.tasks ?? []).map(taskElement).join('\n');
  const summary = confirm.summary
    ? `${readText(join(pageDirectory, confirm.summary), confirm.summary).trim()}\n`
    : '';
  return `<aisf-round number="${roundNumber}">\n${summary}<aisf-confirm>\n${lines}\n</aisf-confirm>\n</aisf-round>`;
}

function taskElement(task) {
  const blockedBy = task.blockedBy?.length > 0 ? ` blocked-by="${task.blockedBy.join(', ')}"` : '';
  const hitl = task.hitl === true ? ' hitl' : '';
  return `<aisf-task number="${task.number}" heading="${escapeAttribute(task.heading)}"${blockedBy}${hitl}></aisf-task>`;
}

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function readCards(pageDirectory, names) {
  return names.map((name) => {
    const file = join(pageDirectory, 'questions', `${name}.html`);
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
