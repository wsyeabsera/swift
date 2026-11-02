import { f216 } from './m216';
export interface Node217 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node217[] }
export function make217(n: number): Node217[] { return Array.from({ length: n }, (_, k) => ({ id: 'n217-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f217(nodes: Node217[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f217([c]); } return s + f216([]); }
