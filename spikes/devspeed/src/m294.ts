import { f293 } from './m293';
export interface Node294 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node294[] }
export function make294(n: number): Node294[] { return Array.from({ length: n }, (_, k) => ({ id: 'n294-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f294(nodes: Node294[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f294([c]); } return s + f293([]); }
