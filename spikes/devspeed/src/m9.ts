import { f8 } from './m8';
export interface Node9 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node9[] }
export function make9(n: number): Node9[] { return Array.from({ length: n }, (_, k) => ({ id: 'n9-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f9(nodes: Node9[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f9([c]); } return s + f8([]); }
