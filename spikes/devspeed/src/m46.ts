import { f45 } from './m45';
export interface Node46 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node46[] }
export function make46(n: number): Node46[] { return Array.from({ length: n }, (_, k) => ({ id: 'n46-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f46(nodes: Node46[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f46([c]); } return s + f45([]); }
