import { f128 } from './m128';
export interface Node129 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node129[] }
export function make129(n: number): Node129[] { return Array.from({ length: n }, (_, k) => ({ id: 'n129-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f129(nodes: Node129[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f129([c]); } return s + f128([]); }
