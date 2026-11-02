import { f278 } from './m278';
export interface Node279 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node279[] }
export function make279(n: number): Node279[] { return Array.from({ length: n }, (_, k) => ({ id: 'n279-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f279(nodes: Node279[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f279([c]); } return s + f278([]); }
