import { f24 } from './m24';
export interface Node25 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node25[] }
export function make25(n: number): Node25[] { return Array.from({ length: n }, (_, k) => ({ id: 'n25-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f25(nodes: Node25[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f25([c]); } return s + f24([]); }
