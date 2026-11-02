import { f240 } from './m240';
export interface Node241 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node241[] }
export function make241(n: number): Node241[] { return Array.from({ length: n }, (_, k) => ({ id: 'n241-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f241(nodes: Node241[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f241([c]); } return s + f240([]); }
