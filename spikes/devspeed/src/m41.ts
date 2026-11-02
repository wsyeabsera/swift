import { f40 } from './m40';
export interface Node41 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node41[] }
export function make41(n: number): Node41[] { return Array.from({ length: n }, (_, k) => ({ id: 'n41-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f41(nodes: Node41[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f41([c]); } return s + f40([]); }
