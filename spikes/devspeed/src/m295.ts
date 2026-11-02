import { f294 } from './m294';
export interface Node295 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node295[] }
export function make295(n: number): Node295[] { return Array.from({ length: n }, (_, k) => ({ id: 'n295-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f295(nodes: Node295[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f295([c]); } return s + f294([]); }
