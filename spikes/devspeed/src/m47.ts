import { f46 } from './m46';
export interface Node47 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node47[] }
export function make47(n: number): Node47[] { return Array.from({ length: n }, (_, k) => ({ id: 'n47-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f47(nodes: Node47[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f47([c]); } return s + f46([]); }
