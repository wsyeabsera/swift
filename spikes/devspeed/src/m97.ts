import { f96 } from './m96';
export interface Node97 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node97[] }
export function make97(n: number): Node97[] { return Array.from({ length: n }, (_, k) => ({ id: 'n97-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f97(nodes: Node97[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f97([c]); } return s + f96([]); }
