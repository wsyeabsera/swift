import { f80 } from './m80';
export interface Node81 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node81[] }
export function make81(n: number): Node81[] { return Array.from({ length: n }, (_, k) => ({ id: 'n81-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f81(nodes: Node81[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f81([c]); } return s + f80([]); }
