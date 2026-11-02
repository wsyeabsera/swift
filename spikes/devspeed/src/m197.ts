import { f196 } from './m196';
export interface Node197 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node197[] }
export function make197(n: number): Node197[] { return Array.from({ length: n }, (_, k) => ({ id: 'n197-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f197(nodes: Node197[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f197([c]); } return s + f196([]); }
