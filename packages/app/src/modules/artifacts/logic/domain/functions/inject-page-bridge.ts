const bridgeTags = (nonce: string): string =>
  `<link rel="stylesheet" href="/aisf/kit.css"><script nonce="${nonce}" src="/aisf/bridge.js"></script><script type="module" nonce="${nonce}" src="/aisf/kit.js"></script>`;

const openingTagPatterns = [/<head(?=[\s>/])[^>]*>/i, /<html(?=[\s>/])[^>]*>/i, /<!doctype[^>]*>/i];

/** Stamps every script with the nonce and adds the kit stylesheet, bridge script and kit module. */
export function injectPageBridge(html: string, nonce: string): string {
  const stamped = html.replace(/<script(?=[\s>/])/gi, `<script nonce="${nonce}"`);
  const tags = bridgeTags(nonce);
  const afterOpening = openingTagPatterns
    .map((pattern) => pattern.exec(stamped))
    .find((match) => match !== null);
  if (afterOpening === undefined || afterOpening === null) {
    return tags + stamped;
  }
  const end = afterOpening.index + afterOpening[0].length;
  return stamped.slice(0, end) + tags + stamped.slice(end);
}
