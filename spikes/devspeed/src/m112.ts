import { f111 } from './m111';
export interface Node112 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node112[] }
export function make112(n: number): Node112[] { return Array.from({ length: n }, (_, k) => ({ id: 'n112-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f112(nodes: Node112[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f112([c]); } return s + f111([]); }
