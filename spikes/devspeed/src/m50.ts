import { f49 } from './m49';
export interface Node50 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node50[] }
export function make50(n: number): Node50[] { return Array.from({ length: n }, (_, k) => ({ id: 'n50-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f50(nodes: Node50[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f50([c]); } return s + f49([]); }
