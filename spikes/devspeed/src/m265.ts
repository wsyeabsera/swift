import { f264 } from './m264';
export interface Node265 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node265[] }
export function make265(n: number): Node265[] { return Array.from({ length: n }, (_, k) => ({ id: 'n265-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f265(nodes: Node265[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f265([c]); } return s + f264([]); }
