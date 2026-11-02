import { f266 } from './m266';
export interface Node267 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node267[] }
export function make267(n: number): Node267[] { return Array.from({ length: n }, (_, k) => ({ id: 'n267-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f267(nodes: Node267[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f267([c]); } return s + f266([]); }
