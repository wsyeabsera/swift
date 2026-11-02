import { f261 } from './m261';
export interface Node262 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node262[] }
export function make262(n: number): Node262[] { return Array.from({ length: n }, (_, k) => ({ id: 'n262-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f262(nodes: Node262[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f262([c]); } return s + f261([]); }
