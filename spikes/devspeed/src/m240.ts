import { f239 } from './m239';
export interface Node240 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node240[] }
export function make240(n: number): Node240[] { return Array.from({ length: n }, (_, k) => ({ id: 'n240-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f240(nodes: Node240[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f240([c]); } return s + f239([]); }
