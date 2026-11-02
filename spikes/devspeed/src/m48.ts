import { f47 } from './m47';
export interface Node48 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node48[] }
export function make48(n: number): Node48[] { return Array.from({ length: n }, (_, k) => ({ id: 'n48-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f48(nodes: Node48[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f48([c]); } return s + f47([]); }
