// The tested contract: spikes/latency/OPS-PROMPT.md (v3, 29/30 valid on 30 varied requests). The app fills tokens, element ids and the selected frame's HTML.
export const MAX_TREE = 6000;
export const SELECTED_MAX = 2500;
export const trimTree = (html: string): string => (html.length <= MAX_TREE ? html : html.slice(0, MAX_TREE) + '<!-- truncated -->');
/** Compact outline of every element (id, tag, short text): what Claude needs to address anything in a frame too big for its full markup. */
export function outline(tree: { id: string; depth: number; tag: string; text: string }[], max = 3000): string {
  const out: string[] = []; let len = 0;
  for (const n of tree) { const line = `${'  '.repeat(n.depth)}#${n.id} <${n.tag}>${n.text ? ` "${n.text}"` : ''}`; if (len + line.length + 1 > max) { out.push('… (outline truncated)'); break; } out.push(line); len += line.length + 1; }
  return out.join('\n');
}
/** What the prompt shows of the frame: the full markup when it fits (the validated default); otherwise the outline of ALL elements plus the full markup of the selected element, so nothing is invisible to Claude. */
export function treeContext(a: { html: string; tree: { id: string; depth: number; tag: string; text: string }[]; selectedHtml?: string }): string {
  if (a.html.length <= MAX_TREE) return a.html;
  const sel = a.selectedHtml ? `\n\nSelected element (full markup${a.selectedHtml.length > SELECTED_MAX ? ', cut' : ''}):\n${a.selectedHtml.slice(0, SELECTED_MAX)}` : ''; // outline (3000) + selected (2500) always fits MAX_TREE, so trimTree never cuts the selection
  return `(This frame is too large to show in full: outline of every element, then the selected element.)\n${outline(a.tree)}${sel}`;
}
export function buildSystemPrompt(a: { tokens: Record<string, string>; ids: string[]; tree: string }): string {
  const tokens = Object.entries(a.tokens).map(([k, v]) => `${k} ${v}`).join(', ');
  return `You edit UI designs. Reply with ONLY JSON operations, one object per line (JSONL), no prose, no code fences, never explanations.
Ops:
{"op":"set","id":"<existing id>","prop":"<css property>","value":"<css value>"}
{"op":"token","name":"<css variable, e.g. --ac>","value":"<value>"}
{"op":"text","id":"<existing id>","value":"<new text>"}
{"op":"add","parent":"<existing id>","id":"<new unique id>","html":"<one element, inline styles>"}
{"op":"remove","id":"<existing id>"}
{"op":"ask","value":"<one short question or reason when the request cannot be done with this tree>"}
Rules: use only ids that exist in the tree (new ids only in add). If the request names something not in the tree, or you need information (a photo, a palette), emit exactly one ask op instead. Always end with the ops, nothing else.
Tokens in scope (use these names and values): ${tokens}. The tree has these elements only: ${a.ids.join(', ')}.
Prefer acting with a sensible default over asking: use ask only when the request needs an element that does not exist, or information you cannot guess (a photo, a URL, another project's palette). For 'add' requests, invent reasonable content.
Selected tree:
${trimTree(a.tree)}`;
}
