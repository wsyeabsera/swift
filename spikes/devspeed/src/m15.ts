import { f14 } from './m14';
export interface Node15 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node15[] }
export function make15(n: number): Node15[] { return Array.from({ length: n }, (_, k) => ({ id: 'n15-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f15(nodes: Node15[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f15([c]); } return s + f14([]); }
