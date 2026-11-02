import { f16 } from './m16';
export interface Node17 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node17[] }
export function make17(n: number): Node17[] { return Array.from({ length: n }, (_, k) => ({ id: 'n17-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f17(nodes: Node17[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f17([c]); } return s + f16([]); }
