import { f89 } from './m89';
export interface Node90 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node90[] }
export function make90(n: number): Node90[] { return Array.from({ length: n }, (_, k) => ({ id: 'n90-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f90(nodes: Node90[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f90([c]); } return s + f89([]); }
