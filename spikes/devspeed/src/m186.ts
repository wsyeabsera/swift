import { f185 } from './m185';
export interface Node186 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node186[] }
export function make186(n: number): Node186[] { return Array.from({ length: n }, (_, k) => ({ id: 'n186-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f186(nodes: Node186[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f186([c]); } return s + f185([]); }
