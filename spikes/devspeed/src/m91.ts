import { f90 } from './m90';
export interface Node91 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node91[] }
export function make91(n: number): Node91[] { return Array.from({ length: n }, (_, k) => ({ id: 'n91-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f91(nodes: Node91[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f91([c]); } return s + f90([]); }
