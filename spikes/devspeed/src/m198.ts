import { f197 } from './m197';
export interface Node198 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node198[] }
export function make198(n: number): Node198[] { return Array.from({ length: n }, (_, k) => ({ id: 'n198-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f198(nodes: Node198[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f198([c]); } return s + f197([]); }
