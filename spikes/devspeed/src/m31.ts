import { f30 } from './m30';
export interface Node31 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node31[] }
export function make31(n: number): Node31[] { return Array.from({ length: n }, (_, k) => ({ id: 'n31-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f31(nodes: Node31[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f31([c]); } return s + f30([]); }
