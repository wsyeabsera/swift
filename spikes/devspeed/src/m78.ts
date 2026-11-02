import { f77 } from './m77';
export interface Node78 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node78[] }
export function make78(n: number): Node78[] { return Array.from({ length: n }, (_, k) => ({ id: 'n78-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f78(nodes: Node78[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f78([c]); } return s + f77([]); }
