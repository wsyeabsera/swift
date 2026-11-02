import { f257 } from './m257';
export interface Node258 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node258[] }
export function make258(n: number): Node258[] { return Array.from({ length: n }, (_, k) => ({ id: 'n258-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f258(nodes: Node258[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f258([c]); } return s + f257([]); }
