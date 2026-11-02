import { f116 } from './m116';
export interface Node117 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node117[] }
export function make117(n: number): Node117[] { return Array.from({ length: n }, (_, k) => ({ id: 'n117-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f117(nodes: Node117[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f117([c]); } return s + f116([]); }
