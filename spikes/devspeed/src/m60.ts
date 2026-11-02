import { f59 } from './m59';
export interface Node60 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node60[] }
export function make60(n: number): Node60[] { return Array.from({ length: n }, (_, k) => ({ id: 'n60-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f60(nodes: Node60[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f60([c]); } return s + f59([]); }
