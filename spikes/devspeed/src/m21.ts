import { f20 } from './m20';
export interface Node21 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node21[] }
export function make21(n: number): Node21[] { return Array.from({ length: n }, (_, k) => ({ id: 'n21-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f21(nodes: Node21[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f21([c]); } return s + f20([]); }
