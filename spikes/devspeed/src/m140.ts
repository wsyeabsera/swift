import { f139 } from './m139';
export interface Node140 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node140[] }
export function make140(n: number): Node140[] { return Array.from({ length: n }, (_, k) => ({ id: 'n140-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f140(nodes: Node140[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f140([c]); } return s + f139([]); }
