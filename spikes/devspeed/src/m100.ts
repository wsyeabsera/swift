import { f99 } from './m99';
export interface Node100 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node100[] }
export function make100(n: number): Node100[] { return Array.from({ length: n }, (_, k) => ({ id: 'n100-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f100(nodes: Node100[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f100([c]); } return s + f99([]); }
