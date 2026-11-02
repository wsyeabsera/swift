import { f63 } from './m63';
export interface Node64 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node64[] }
export function make64(n: number): Node64[] { return Array.from({ length: n }, (_, k) => ({ id: 'n64-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f64(nodes: Node64[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f64([c]); } return s + f63([]); }
