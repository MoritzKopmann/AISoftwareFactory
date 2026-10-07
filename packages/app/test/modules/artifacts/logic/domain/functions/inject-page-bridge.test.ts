import { describe, expect, it } from 'vitest';
import { injectPageBridge } from '../../../../../../src/modules/artifacts/logic/domain/functions/inject-page-bridge.js';

describe('injectPageBridge', () => {
  it('should add the stylesheet and the nonced bridge script inside the head when the page has one', () => {
    const html = injectPageBridge('<!doctype html><html><head><title>x</title></head></html>', 'N');

    expect(html).toContain(
      '<head><link rel="stylesheet" href="/aisf/kit.css"><script nonce="N" src="/aisf/bridge.js"></script><script type="module" nonce="N" src="/aisf/kit.js"></script><title>',
    );
  });

  it('should stamp every script with the nonce when the page has inline and external scripts', () => {
    const html = injectPageBridge(
      '<head></head><body><script>1</script><SCRIPT src="app.js"></SCRIPT></body>',
      'N',
    );

    const scripts = html.match(/<script[^>]*>/gi) ?? [];
    expect(scripts).toHaveLength(4);
    for (const script of scripts) {
      expect(script).toContain('nonce="N"');
    }
  });

  it('should keep a script-like tag name unchanged when it only starts with script', () => {
    expect(injectPageBridge('<head></head><scripted></scripted>', 'N')).toContain('<scripted>');
  });

  it('should add the tags after the doctype when the page has no head', () => {
    expect(injectPageBridge('<!DOCTYPE html><p>hi</p>', 'N')).toMatch(
      /^<!DOCTYPE html><link rel="stylesheet" href="\/aisf\/kit.css"><script nonce="N"/,
    );
  });

  it('should put the tags first when the page is a bare fragment', () => {
    expect(injectPageBridge('<p>hi</p>', 'N')).toMatch(/^<link rel="stylesheet"/);
  });
});
