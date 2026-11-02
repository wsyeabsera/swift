import { f186 } from './m186';
export interface Node187 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node187[] }
export function make187(n: number): Node187[] { return Array.from({ length: n }, (_, k) => ({ id: 'n187-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f187(nodes: Node187[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f187([c]); } return s + f186([]); }
