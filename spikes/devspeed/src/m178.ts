import { f177 } from './m177';
export interface Node178 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node178[] }
export function make178(n: number): Node178[] { return Array.from({ length: n }, (_, k) => ({ id: 'n178-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f178(nodes: Node178[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f178([c]); } return s + f177([]); }
