import { f100 } from './m100';
export interface Node101 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node101[] }
export function make101(n: number): Node101[] { return Array.from({ length: n }, (_, k) => ({ id: 'n101-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f101(nodes: Node101[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f101([c]); } return s + f100([]); }
