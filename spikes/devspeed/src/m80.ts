import { f79 } from './m79';
export interface Node80 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node80[] }
export function make80(n: number): Node80[] { return Array.from({ length: n }, (_, k) => ({ id: 'n80-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f80(nodes: Node80[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f80([c]); } return s + f79([]); }
