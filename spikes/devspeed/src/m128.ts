import { f127 } from './m127';
export interface Node128 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node128[] }
export function make128(n: number): Node128[] { return Array.from({ length: n }, (_, k) => ({ id: 'n128-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f128(nodes: Node128[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f128([c]); } return s + f127([]); }
