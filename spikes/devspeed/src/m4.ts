import { f3 } from './m3';
export interface Node4 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node4[] }
export function make4(n: number): Node4[] { return Array.from({ length: n }, (_, k) => ({ id: 'n4-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f4(nodes: Node4[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f4([c]); } return s + f3([]); }
