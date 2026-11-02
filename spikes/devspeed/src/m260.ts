import { f259 } from './m259';
export interface Node260 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node260[] }
export function make260(n: number): Node260[] { return Array.from({ length: n }, (_, k) => ({ id: 'n260-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f260(nodes: Node260[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f260([c]); } return s + f259([]); }
