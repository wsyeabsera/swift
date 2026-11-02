import { f138 } from './m138';
export interface Node139 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node139[] }
export function make139(n: number): Node139[] { return Array.from({ length: n }, (_, k) => ({ id: 'n139-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f139(nodes: Node139[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f139([c]); } return s + f138([]); }
