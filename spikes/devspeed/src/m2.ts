import { f1 } from './m1';
export interface Node2 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node2[] }
export function make2(n: number): Node2[] { return Array.from({ length: n }, (_, k) => ({ id: 'n2-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f2(nodes: Node2[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f2([c]); } return s + f1([]); }
