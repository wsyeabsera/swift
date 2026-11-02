import { f254 } from './m254';
export interface Node255 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node255[] }
export function make255(n: number): Node255[] { return Array.from({ length: n }, (_, k) => ({ id: 'n255-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f255(nodes: Node255[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f255([c]); } return s + f254([]); }
