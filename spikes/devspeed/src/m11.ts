import { f10 } from './m10';
export interface Node11 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node11[] }
export function make11(n: number): Node11[] { return Array.from({ length: n }, (_, k) => ({ id: 'n11-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f11(nodes: Node11[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f11([c]); } return s + f10([]); }
