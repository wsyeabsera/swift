import { f212 } from './m212';
export interface Node213 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node213[] }
export function make213(n: number): Node213[] { return Array.from({ length: n }, (_, k) => ({ id: 'n213-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f213(nodes: Node213[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f213([c]); } return s + f212([]); }
