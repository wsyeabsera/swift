import { f235 } from './m235';
export interface Node236 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node236[] }
export function make236(n: number): Node236[] { return Array.from({ length: n }, (_, k) => ({ id: 'n236-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f236(nodes: Node236[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f236([c]); } return s + f235([]); }
