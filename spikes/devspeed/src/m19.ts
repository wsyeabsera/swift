import { f18 } from './m18';
export interface Node19 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node19[] }
export function make19(n: number): Node19[] { return Array.from({ length: n }, (_, k) => ({ id: 'n19-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f19(nodes: Node19[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f19([c]); } return s + f18([]); }
