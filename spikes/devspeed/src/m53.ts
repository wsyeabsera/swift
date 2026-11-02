import { f52 } from './m52';
export interface Node53 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node53[] }
export function make53(n: number): Node53[] { return Array.from({ length: n }, (_, k) => ({ id: 'n53-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f53(nodes: Node53[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f53([c]); } return s + f52([]); }
