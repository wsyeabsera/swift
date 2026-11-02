import { f101 } from './m101';
export interface Node102 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node102[] }
export function make102(n: number): Node102[] { return Array.from({ length: n }, (_, k) => ({ id: 'n102-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f102(nodes: Node102[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f102([c]); } return s + f101([]); }
