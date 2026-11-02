import { f173 } from './m173';
export interface Node174 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node174[] }
export function make174(n: number): Node174[] { return Array.from({ length: n }, (_, k) => ({ id: 'n174-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f174(nodes: Node174[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f174([c]); } return s + f173([]); }
