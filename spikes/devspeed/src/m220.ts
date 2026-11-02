import { f219 } from './m219';
export interface Node220 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node220[] }
export function make220(n: number): Node220[] { return Array.from({ length: n }, (_, k) => ({ id: 'n220-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f220(nodes: Node220[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f220([c]); } return s + f219([]); }
