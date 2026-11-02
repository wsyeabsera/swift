import { f9 } from './m9';
export interface Node10 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node10[] }
export function make10(n: number): Node10[] { return Array.from({ length: n }, (_, k) => ({ id: 'n10-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f10(nodes: Node10[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f10([c]); } return s + f9([]); }
