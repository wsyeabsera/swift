import { f201 } from './m201';
export interface Node202 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node202[] }
export function make202(n: number): Node202[] { return Array.from({ length: n }, (_, k) => ({ id: 'n202-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f202(nodes: Node202[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f202([c]); } return s + f201([]); }
