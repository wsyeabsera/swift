import { f136 } from './m136';
export interface Node137 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node137[] }
export function make137(n: number): Node137[] { return Array.from({ length: n }, (_, k) => ({ id: 'n137-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f137(nodes: Node137[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f137([c]); } return s + f136([]); }
