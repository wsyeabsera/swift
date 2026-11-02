import { f86 } from './m86';
export interface Node87 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node87[] }
export function make87(n: number): Node87[] { return Array.from({ length: n }, (_, k) => ({ id: 'n87-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f87(nodes: Node87[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f87([c]); } return s + f86([]); }
