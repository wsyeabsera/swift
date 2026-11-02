import { f115 } from './m115';
export interface Node116 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node116[] }
export function make116(n: number): Node116[] { return Array.from({ length: n }, (_, k) => ({ id: 'n116-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f116(nodes: Node116[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f116([c]); } return s + f115([]); }
