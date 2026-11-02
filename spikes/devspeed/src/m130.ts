import { f129 } from './m129';
export interface Node130 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node130[] }
export function make130(n: number): Node130[] { return Array.from({ length: n }, (_, k) => ({ id: 'n130-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f130(nodes: Node130[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f130([c]); } return s + f129([]); }
