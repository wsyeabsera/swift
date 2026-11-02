import { f180 } from './m180';
export interface Node181 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node181[] }
export function make181(n: number): Node181[] { return Array.from({ length: n }, (_, k) => ({ id: 'n181-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f181(nodes: Node181[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f181([c]); } return s + f180([]); }
