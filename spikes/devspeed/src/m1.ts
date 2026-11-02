import { f0 } from './m0';
export interface Node1 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node1[] }
export function make1(n: number): Node1[] { return Array.from({ length: n }, (_, k) => ({ id: 'n1-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f1(nodes: Node1[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f1([c]); } return s + f0([]); }
