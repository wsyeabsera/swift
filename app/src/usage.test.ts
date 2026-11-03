import { describe, expect, it } from 'vitest';
import { addUsage, appendUsage, estimateTokens, loadUsage, MAX_USAGE, saveUsage, summarizeUsage } from './usage';
describe('usage', () => {
  it('estimates chars/4 rounded up', () => { expect(estimateTokens('')).toBe(0); expect(estimateTokens('abcde')).toBe(2); });
  it('adds and summarizes', () => {
    expect(addUsage({ input: 1, output: 2 }, { input: 3, output: 4 })).toEqual({ input: 4, output: 6 });
    expect(summarizeUsage([])).toEqual({ requests: 0, input: 0, output: 0, avgInput: 0, avgOutput: 0 });
    expect(summarizeUsage([{ input: 10, output: 1 }, { input: 21, output: 2 }])).toEqual({ requests: 2, input: 31, output: 3, avgInput: 16, avgOutput: 2 });
  });
  it('caps at 500 and round-trips through storage', () => {
    let l: { input: number; output: number; at: number }[] = []; for (let i = 0; i < 510; i++) l = appendUsage(l, { input: i, output: 1, at: i });
    expect(l).toHaveLength(MAX_USAGE); expect(l[0]?.input).toBe(10);
    let saved = ''; expect(saveUsage(l, { setItem: (_k, v) => { saved = v; } })).toBeNull();
    expect(loadUsage({ getItem: () => saved })).toHaveLength(MAX_USAGE);
  });
  it('is safe against bad or missing storage', () => {
    expect(loadUsage(undefined)).toEqual([]); expect(loadUsage({ getItem: () => 'not json' })).toEqual([]);
    expect(loadUsage({ getItem: () => JSON.stringify([{ input: 1, output: 2, at: 3 }, { input: -1 }, 'x']) })).toHaveLength(1);
    expect(loadUsage({ getItem: () => { throw new Error('no'); } })).toEqual([]);
    expect(saveUsage([], undefined)).toBe('storage unavailable'); expect(saveUsage([], { setItem: () => { throw new Error('quota'); } })).toBe('quota');
  });
});

import { DEFAULT_REQUEST, estimateSpark, tokensShort } from './usage';
it('Spark estimate: measured defaults until 3 samples, then n x the recent average; compact counts', () => {
  expect(estimateSpark([], 4)).toEqual({ input: DEFAULT_REQUEST.input * 4, output: DEFAULT_REQUEST.output * 4 }); expect(estimateSpark([{ input: 100, output: 10 }, { input: 200, output: 20 }], 2)).toEqual({ input: 8200, output: 300 });
  expect(estimateSpark([{ input: 1000, output: 100 }, { input: 2000, output: 200 }, { input: 3000, output: 300 }], 4)).toEqual({ input: 8000, output: 800 });
  expect(tokensShort(950)).toBe('950'); expect(tokensShort(17250)).toBe('17k'); expect(tokensShort(1_250_000)).toBe('1.3M');
});
