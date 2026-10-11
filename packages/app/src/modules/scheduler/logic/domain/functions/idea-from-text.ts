import type { IdeaDraft } from '../types/idea-draft.js';

const maximumTitleLength = 80;

export function ideaFromText(text: string): IdeaDraft {
  const firstLine = (text.split('\n')[0] ?? '').trimEnd();
  const title = cutAtWord(firstLine);
  return { title, body: title === text ? '' : text };
}

function cutAtWord(line: string): string {
  if (line.length <= maximumTitleLength) {
    return line;
  }
  const lastSpaceIndex = line.lastIndexOf(' ', maximumTitleLength - 1);
  const keptText = line.slice(0, lastSpaceIndex === -1 ? maximumTitleLength - 1 : lastSpaceIndex);
  return `${keptText.trimEnd()}…`;
}
