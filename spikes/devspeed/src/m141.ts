import { f140 } from './m140';
export interface Node141 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node141[] }
export function make141(n: number): Node141[] { return Array.from({ length: n }, (_, k) => ({ id: 'n141-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f141(nodes: Node141[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f141([c]); } return s + f140([]); }
