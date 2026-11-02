import { f12 } from './m12';
export interface Node13 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node13[] }
export function make13(n: number): Node13[] { return Array.from({ length: n }, (_, k) => ({ id: 'n13-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f13(nodes: Node13[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f13([c]); } return s + f12([]); }
