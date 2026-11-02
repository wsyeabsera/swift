import { f28 } from './m28';
export interface Node29 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node29[] }
export function make29(n: number): Node29[] { return Array.from({ length: n }, (_, k) => ({ id: 'n29-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f29(nodes: Node29[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f29([c]); } return s + f28([]); }
