import { f11 } from './m11';
export interface Node12 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node12[] }
export function make12(n: number): Node12[] { return Array.from({ length: n }, (_, k) => ({ id: 'n12-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f12(nodes: Node12[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f12([c]); } return s + f11([]); }
