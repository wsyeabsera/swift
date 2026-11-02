import { f174 } from './m174';
export interface Node175 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node175[] }
export function make175(n: number): Node175[] { return Array.from({ length: n }, (_, k) => ({ id: 'n175-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f175(nodes: Node175[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f175([c]); } return s + f174([]); }
