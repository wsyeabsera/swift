import { f27 } from './m27';
export interface Node28 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node28[] }
export function make28(n: number): Node28[] { return Array.from({ length: n }, (_, k) => ({ id: 'n28-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f28(nodes: Node28[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f28([c]); } return s + f27([]); }
