import { f224 } from './m224';
export interface Node225 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node225[] }
export function make225(n: number): Node225[] { return Array.from({ length: n }, (_, k) => ({ id: 'n225-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f225(nodes: Node225[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f225([c]); } return s + f224([]); }
