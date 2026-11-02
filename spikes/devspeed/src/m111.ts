import { f110 } from './m110';
export interface Node111 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node111[] }
export function make111(n: number): Node111[] { return Array.from({ length: n }, (_, k) => ({ id: 'n111-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f111(nodes: Node111[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f111([c]); } return s + f110([]); }
