import { f60 } from './m60';
export interface Node61 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node61[] }
export function make61(n: number): Node61[] { return Array.from({ length: n }, (_, k) => ({ id: 'n61-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f61(nodes: Node61[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f61([c]); } return s + f60([]); }
