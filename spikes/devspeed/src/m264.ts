import { f263 } from './m263';
export interface Node264 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node264[] }
export function make264(n: number): Node264[] { return Array.from({ length: n }, (_, k) => ({ id: 'n264-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f264(nodes: Node264[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f264([c]); } return s + f263([]); }
