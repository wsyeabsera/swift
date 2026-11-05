import { describe, expect, it } from 'vitest';
import { PACKS, fillText, formatDate, packIds, record, records, resolve, series } from './pack';

describe('content packs', () => {
  it('ships the five packs and every record/template references real fields', () => {
    expect(packIds().sort()).toEqual(['copy', 'metrics', 'orders', 'people', 'products']);
    for (const p of Object.values(PACKS)) {
      for (const [r, fs] of Object.entries(p.records)) for (const f of fs) expect(p.fields[f], `${p.id}.${r}.${f}`).toBeTruthy();
      for (const t of Object.values(p.templates)) for (const m of t.matchAll(/\{(\w+)\}/g)) expect(p.fields[m[1]!], `${p.id} template ${t}`).toBeTruthy();
      for (const f of Object.values(p.fields)) if (f.kind === 'pick') { const l = Array.isArray(f.values) ? f.values : f.values.en; expect(l && l.length).toBeGreaterThan(2); }
    }
  });
  it('same seed gives byte-identical output; another seed differs', () => {
    const out = (seed: string) => JSON.stringify([records('people.person', 6, { seed }), records('orders.order', 6, { seed }), series('metrics.revenue', 12, { seed }), resolve('copy.headline', { seed })]);
    expect(out('a')).toBe(out('a'));
    expect(out('a')).not.toBe(out('b'));
  });
  it('index is independent of other slots: adding rows never changes earlier ones', () => {
    expect(records('people.person', 3, { seed: 1 })).toEqual(records('people.person', 8, { seed: 1 }).slice(0, 3));
  });
  it('templates agree with record fields at the same index', () => {
    const c = { seed: 7, index: 2 }; const r = record('people.person', c);
    expect(resolve('people.name', c)).toBe(`${r.first} ${r.last}`);
    expect(resolve('people.email', c)).toBe(`${r.first}.${r.last}@example.com`);
  });
  it('locale changes number and date formats', () => {
    const en = resolve('products.price', { seed: 3, locale: 'en-US' }); const de = resolve('products.price', { seed: 3, locale: 'de-DE' });
    expect(en).toMatch(/^\$\d/); expect(de).toMatch(/€/); expect(en).not.toBe(de);
    expect(resolve('metrics.users', { seed: 3, locale: 'en-US', index: 4 })).toMatch(/,/); // thousands comma
    expect(resolve('metrics.users', { seed: 3, locale: 'de-DE', index: 4 })).toMatch(/\./);
    const d = new Date(Date.UTC(2026, 9, 5)); expect(formatDate(d, { seed: 0, locale: 'en-US' })).toBe('Oct 5, 2026'); expect(formatDate(d, { seed: 0, locale: 'de-DE' })).toBe('05.10.2026');
    expect(resolve('conversion' === 'x' ? '' : 'metrics.conversion', { seed: 3, locale: 'de-DE' })).toMatch(/%/);
  });
  it('text packs localize with fallback to en', () => {
    const de = resolve('copy.cta', { seed: 2, locale: 'de-DE' }); const en = resolve('copy.cta', { seed: 2, locale: 'en-US' }); const ja = resolve('copy.cta', { seed: 2, locale: 'ja-JP' });
    expect(de).not.toBe(en); expect(ja).toBe(en);
  });
  it('series stays in range, has the length asked, and is smooth-ish', () => {
    const s = series('metrics.revenue', 30, { seed: 'q' }); expect(s).toHaveLength(30);
    for (const v of s) { expect(v).toBeGreaterThanOrEqual(18000); expect(v).toBeLessThanOrEqual(240000); }
    for (let i = 1; i < s.length; i++) expect(Math.abs(s[i]! - s[i - 1]!)).toBeLessThan(0.2 * (240000 - 18000));
  });
  it('fillText fills markers and throws on unknown refs and bad input (no silent lorem)', () => {
    expect(fillText('Hi {{ people.name }}, {{copy.cta}}', { seed: 1 })).toBe(`Hi ${resolve('people.name', { seed: 1 })}, ${resolve('copy.cta', { seed: 1 })}`);
    expect(() => fillText('{{nope.x}}', { seed: 1 })).toThrow(/unknown content pack "nope"/);
    expect(() => resolve('people.zzz', { seed: 1 })).toThrow(/no field "zzz"/);
    expect(() => resolve('people', { seed: 1 })).toThrow(/bad content reference/);
    expect(() => series('people.first', 3, { seed: 1 })).toThrow(/not a number/);
    expect(() => record('people.nope', { seed: 1 })).toThrow(/no record/);
  });
  it('a bad locale falls back instead of throwing', () => { expect(resolve('products.price', { seed: 1, locale: 'not a locale!!' })).toMatch(/^\$/); });
});
