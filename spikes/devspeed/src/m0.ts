export interface Node0 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node0[] }
export function make0(n: number): Node0[] { return Array.from({ length: n }, (_, k) => ({ id: 'n0-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f0(nodes: Node0[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f0([c]); } return s; }
