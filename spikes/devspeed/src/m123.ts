import { f122 } from './m122';
export interface Node123 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node123[] }
export function make123(n: number): Node123[] { return Array.from({ length: n }, (_, k) => ({ id: 'n123-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f123(nodes: Node123[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f123([c]); } return s + f122([]); }
