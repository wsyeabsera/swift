import { f288 } from './m288';
export interface Node289 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node289[] }
export function make289(n: number): Node289[] { return Array.from({ length: n }, (_, k) => ({ id: 'n289-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f289(nodes: Node289[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f289([c]); } return s + f288([]); }
