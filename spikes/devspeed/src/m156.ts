import { f155 } from './m155';
export interface Node156 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node156[] }
export function make156(n: number): Node156[] { return Array.from({ length: n }, (_, k) => ({ id: 'n156-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f156(nodes: Node156[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f156([c]); } return s + f155([]); }
