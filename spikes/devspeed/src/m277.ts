import { f276 } from './m276';
export interface Node277 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node277[] }
export function make277(n: number): Node277[] { return Array.from({ length: n }, (_, k) => ({ id: 'n277-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f277(nodes: Node277[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f277([c]); } return s + f276([]); }
