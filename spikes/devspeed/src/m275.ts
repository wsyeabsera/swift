import { f274 } from './m274';
export interface Node275 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node275[] }
export function make275(n: number): Node275[] { return Array.from({ length: n }, (_, k) => ({ id: 'n275-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f275(nodes: Node275[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f275([c]); } return s + f274([]); }
