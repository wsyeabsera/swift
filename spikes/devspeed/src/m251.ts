import { f250 } from './m250';
export interface Node251 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node251[] }
export function make251(n: number): Node251[] { return Array.from({ length: n }, (_, k) => ({ id: 'n251-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f251(nodes: Node251[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f251([c]); } return s + f250([]); }
