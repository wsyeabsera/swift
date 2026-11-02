import { f4 } from './m4';
export interface Node5 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node5[] }
export function make5(n: number): Node5[] { return Array.from({ length: n }, (_, k) => ({ id: 'n5-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f5(nodes: Node5[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f5([c]); } return s + f4([]); }
