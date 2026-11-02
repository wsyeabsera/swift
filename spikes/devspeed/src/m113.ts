import { f112 } from './m112';
export interface Node113 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node113[] }
export function make113(n: number): Node113[] { return Array.from({ length: n }, (_, k) => ({ id: 'n113-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f113(nodes: Node113[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f113([c]); } return s + f112([]); }
