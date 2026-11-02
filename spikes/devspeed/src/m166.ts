import { f165 } from './m165';
export interface Node166 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node166[] }
export function make166(n: number): Node166[] { return Array.from({ length: n }, (_, k) => ({ id: 'n166-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f166(nodes: Node166[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f166([c]); } return s + f165([]); }
