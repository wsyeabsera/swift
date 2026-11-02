import { f15 } from './m15';
export interface Node16 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node16[] }
export function make16(n: number): Node16[] { return Array.from({ length: n }, (_, k) => ({ id: 'n16-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f16(nodes: Node16[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f16([c]); } return s + f15([]); }
