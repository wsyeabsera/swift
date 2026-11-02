import { f6 } from './m6';
export interface Node7 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node7[] }
export function make7(n: number): Node7[] { return Array.from({ length: n }, (_, k) => ({ id: 'n7-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f7(nodes: Node7[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f7([c]); } return s + f6([]); }
