import { f126 } from './m126';
export interface Node127 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node127[] }
export function make127(n: number): Node127[] { return Array.from({ length: n }, (_, k) => ({ id: 'n127-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f127(nodes: Node127[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f127([c]); } return s + f126([]); }
