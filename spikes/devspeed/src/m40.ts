import { f39 } from './m39';
export interface Node40 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node40[] }
export function make40(n: number): Node40[] { return Array.from({ length: n }, (_, k) => ({ id: 'n40-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f40(nodes: Node40[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f40([c]); } return s + f39([]); }
