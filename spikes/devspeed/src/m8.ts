import { f7 } from './m7';
export interface Node8 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node8[] }
export function make8(n: number): Node8[] { return Array.from({ length: n }, (_, k) => ({ id: 'n8-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f8(nodes: Node8[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f8([c]); } return s + f7([]); }
