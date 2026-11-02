import { f17 } from './m17';
export interface Node18 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node18[] }
export function make18(n: number): Node18[] { return Array.from({ length: n }, (_, k) => ({ id: 'n18-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f18(nodes: Node18[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f18([c]); } return s + f17([]); }
