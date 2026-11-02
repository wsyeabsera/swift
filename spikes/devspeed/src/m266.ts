import { f265 } from './m265';
export interface Node266 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node266[] }
export function make266(n: number): Node266[] { return Array.from({ length: n }, (_, k) => ({ id: 'n266-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f266(nodes: Node266[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f266([c]); } return s + f265([]); }
