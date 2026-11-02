import { f249 } from './m249';
export interface Node250 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node250[] }
export function make250(n: number): Node250[] { return Array.from({ length: n }, (_, k) => ({ id: 'n250-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f250(nodes: Node250[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f250([c]); } return s + f249([]); }
