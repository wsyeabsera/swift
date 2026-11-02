import { f2 } from './m2';
export interface Node3 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node3[] }
export function make3(n: number): Node3[] { return Array.from({ length: n }, (_, k) => ({ id: 'n3-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f3(nodes: Node3[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f3([c]); } return s + f2([]); }
