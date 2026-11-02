import { f102 } from './m102';
export interface Node103 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node103[] }
export function make103(n: number): Node103[] { return Array.from({ length: n }, (_, k) => ({ id: 'n103-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f103(nodes: Node103[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f103([c]); } return s + f102([]); }
