import { f85 } from './m85';
export interface Node86 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node86[] }
export function make86(n: number): Node86[] { return Array.from({ length: n }, (_, k) => ({ id: 'n86-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f86(nodes: Node86[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f86([c]); } return s + f85([]); }
