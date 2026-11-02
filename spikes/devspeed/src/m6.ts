import { f5 } from './m5';
export interface Node6 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node6[] }
export function make6(n: number): Node6[] { return Array.from({ length: n }, (_, k) => ({ id: 'n6-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f6(nodes: Node6[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f6([c]); } return s + f5([]); }
