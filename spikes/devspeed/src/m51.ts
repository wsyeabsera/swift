import { f50 } from './m50';
export interface Node51 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node51[] }
export function make51(n: number): Node51[] { return Array.from({ length: n }, (_, k) => ({ id: 'n51-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f51(nodes: Node51[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f51([c]); } return s + f50([]); }
