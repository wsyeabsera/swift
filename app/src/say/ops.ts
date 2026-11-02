// The Say op language (spikes/latency/OPS-PROMPT.md, v3). Model output is UNTRUSTED: every line is parsed and validated before it touches a frame.
export type Op =
  | { op: 'set'; id: string; prop: string; value: string }
  | { op: 'token'; name: string; value: string }
  | { op: 'text'; id: string; value: string }
  | { op: 'add'; parent: string; id: string; html: string }
  | { op: 'remove'; id: string }
  | { op: 'ask'; value: string };
export type Checked = { ok: true; op: Op } | { ok: false; error: string };
const PROP = /^(--)?[a-z][a-z0-9-]*$/i; const BAD_HTML = /<\s*script|\son\w+\s*=|javascript:/i; const MAX = 4000;
const str = (v: unknown): v is string => typeof v === 'string';
/** Validate one JSONL line against the ids that exist in the frame (`ids` grows when an `add` is accepted, so later ops can use the new element). */
export function checkLine(line: string, ids: Set<string>): Checked {
  let o: unknown; try { o = JSON.parse(line); } catch { return { ok: false, error: 'not JSON' }; }
  if (typeof o !== 'object' || o === null) return { ok: false, error: 'not an object' };
  const m = o as Record<string, unknown>; const has = (id: unknown): id is string => str(id) && ids.has(id);
  switch (m.op) {
    case 'set': if (!has(m.id)) return { ok: false, error: `unknown id ${String(m.id)}` }; if (!str(m.prop) || !PROP.test(m.prop)) return { ok: false, error: 'bad property' }; if (!str(m.value) || m.value.length > 200) return { ok: false, error: 'bad value' }; return { ok: true, op: { op: 'set', id: m.id, prop: m.prop, value: m.value } };
    case 'token': if (!str(m.name) || !/^--[a-z0-9-]+$/i.test(m.name)) return { ok: false, error: 'bad token name' }; if (!str(m.value) || m.value.length > 200) return { ok: false, error: 'bad value' }; return { ok: true, op: { op: 'token', name: m.name, value: m.value } };
    case 'text': if (!has(m.id)) return { ok: false, error: `unknown id ${String(m.id)}` }; if (!str(m.value) || m.value.length > MAX) return { ok: false, error: 'bad text' }; return { ok: true, op: { op: 'text', id: m.id, value: m.value } };
    case 'add': { if (!has(m.parent)) return { ok: false, error: `unknown parent ${String(m.parent)}` }; if (!str(m.id) || !/^[a-z][a-z0-9_-]*$/i.test(m.id) || ids.has(m.id)) return { ok: false, error: 'bad or duplicate id' }; if (!str(m.html) || m.html.length === 0 || m.html.length > MAX || BAD_HTML.test(m.html)) return { ok: false, error: 'bad html' }; ids.add(m.id); return { ok: true, op: { op: 'add', parent: m.parent, id: m.id, html: m.html } }; }
    case 'remove': if (!has(m.id)) return { ok: false, error: `unknown id ${String(m.id)}` }; return { ok: true, op: { op: 'remove', id: m.id } };
    case 'ask': if (!str(m.value) || m.value.length === 0) return { ok: false, error: 'bad ask' }; return { ok: true, op: { op: 'ask', value: m.value.slice(0, 300) } };
    default: return { ok: false, error: `unknown op ${String(m.op)}` };
  }
}
/** Streamed text arrives in arbitrary chunks: yield only complete, non-empty lines. `flush()` returns a final unterminated line. */
export class LineSplitter {
  private buf = '';
  push(chunk: string): string[] { this.buf += chunk; const parts = this.buf.split('\n'); this.buf = parts.pop() ?? ''; return parts.map((l) => l.trim()).filter(Boolean); }
  flush(): string[] { const rest = this.buf.trim(); this.buf = ''; return rest ? [rest] : []; }
}
