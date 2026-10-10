import { describe, expect, it } from 'vitest';
import { parseAutoConfigLink } from '../src/lib/autoConfig';

describe('parseAutoConfigLink', () => {
  it('reads url, token and user from the partner link', () => {
    const script = 'https://script.google.com/macros/s/abc/exec';
    const link = `https://hjsanoja.github.io/Preztame/?scriptUrl=${encodeURIComponent(script)}&token=k3y&user=Nando`;
    expect(parseAutoConfigLink(`  ${link}  `)).toEqual({ url: script, token: 'k3y', user: 'Nando' });
  });

  it('rejects links without url or token', () => {
    expect(parseAutoConfigLink('https://x.dev/?scriptUrl=a')).toBeNull();
    expect(parseAutoConfigLink('no es un link')).toBeNull();
  });
});
