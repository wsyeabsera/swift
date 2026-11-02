import { f280 } from './m280';
export interface Node281 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node281[] }
export function make281(n: number): Node281[] { return Array.from({ length: n }, (_, k) => ({ id: 'n281-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f281(nodes: Node281[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f281([c]); } return s + f280([]); }
