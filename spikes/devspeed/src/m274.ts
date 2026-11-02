import { f273 } from './m273';
export interface Node274 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node274[] }
export function make274(n: number): Node274[] { return Array.from({ length: n }, (_, k) => ({ id: 'n274-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f274(nodes: Node274[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f274([c]); } return s + f273([]); }
