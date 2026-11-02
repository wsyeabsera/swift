import { f256 } from './m256';
export interface Node257 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node257[] }
export function make257(n: number): Node257[] { return Array.from({ length: n }, (_, k) => ({ id: 'n257-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f257(nodes: Node257[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f257([c]); } return s + f256([]); }
