import { f13 } from './m13';
export interface Node14 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node14[] }
export function make14(n: number): Node14[] { return Array.from({ length: n }, (_, k) => ({ id: 'n14-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f14(nodes: Node14[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f14([c]); } return s + f13([]); }
